package com.happyfamily.shortformmaker;

import android.app.Activity;
import android.content.ContentValues;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;

import androidx.media3.common.Effect;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.effect.BitmapOverlay;
import androidx.media3.effect.MatrixTransformation;
import androidx.media3.effect.OverlayEffect;
import androidx.media3.effect.OverlaySettings;
import androidx.media3.effect.Presentation;
import androidx.media3.effect.TextureOverlay;
import androidx.media3.transformer.Composition;
import androidx.media3.transformer.EditedMediaItem;
import androidx.media3.transformer.EditedMediaItemSequence;
import androidx.media3.transformer.Effects;
import androidx.media3.transformer.ExportException;
import androidx.media3.transformer.ExportResult;
import androidx.media3.transformer.ProgressHolder;
import androidx.media3.transformer.Transformer;

import com.google.common.collect.ImmutableList;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.ByteArrayOutputStream;
import java.io.RandomAccessFile;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * 클립 여러 개를 이어 붙이고 자막을 새겨 세로 1080x1920 MP4 하나로 만든다 (Media3 Transformer).
 * 결과는 사진·동영상 앱의 Movies/ShortFormMaker 에 저장하고 JS 의 window.onAssemble 로 알린다.
 */
class VideoMaker {
    interface Callback { void send(JSONObject o); }

    private final Activity act;
    private final Handler main = new Handler(Looper.getMainLooper());
    private Transformer transformer;
    private File outFile;
    private String title;
    private Callback cb;

    VideoMaker(Activity a) { act = a; }

    private volatile boolean active = false;
    boolean busy() { return active || transformer != null; }

    void cancel() {
        main.post(() -> { cancelled = true; if (transformer != null) { transformer.cancel(); transformer = null; cleanup(); send("cancelled", 0, null, null); } });
    }

    /* job.clips(영상 uri 목록) 또는 job.items([{video:uri} | {image:dataURL, ms}]) 를 받는다.
       사진은 먼저 천천히 확대되는 짧은 영상으로 만든 뒤, 영상들과 이어 붙인다. */
    private final List<String> parts = new ArrayList<>();
    private final List<int[]> stillJobs = new ArrayList<>();   /* {parts 위치, 길이 ms} */
    private final List<File> stillFiles = new ArrayList<>();
    private JSONObject job;
    private String baseVideo;   /* 사진 샷의 바탕으로 쓸 영상 (소리는 뺀다) */
    private int stillsDone = 0;
    private boolean cancelled = false;

    void start(JSONObject j, Callback callback) {
        cb = callback; job = j; cancelled = false; active = true;
        main.post(() -> {
            try {
                parts.clear(); stillJobs.clear(); stillFiles.clear(); stillsDone = 0;
                title = job.optString("title", "short-form");
                JSONArray items = job.optJSONArray("items");
                if (items == null) {
                    JSONArray clips = job.getJSONArray("clips");
                    for (int i = 0; i < clips.length(); i++) parts.add(clips.getString(i));
                } else {
                    for (int i = 0; i < items.length(); i++) {
                        JSONObject it = items.getJSONObject(i);
                        if (it.has("image")) {
                            String d = it.getString("image"); d = d.substring(d.indexOf(',') + 1);
                            File f = new File(act.getCacheDir(), "still_" + System.currentTimeMillis() + "_" + i + ".jpg");
                            try (java.io.FileOutputStream os = new java.io.FileOutputStream(f)) { os.write(android.util.Base64.decode(d, android.util.Base64.DEFAULT)); }
                            stillFiles.add(f);
                            stillJobs.add(new int[]{parts.size(), it.optInt("ms", 5000)});
                            parts.add(Uri.fromFile(f).toString());
                        } else parts.add(it.getString("video"));
                    }
                }
                send("running", 0, null, null);
                narration = null;
                baseVideo = null;
                for (int i = 0; i < parts.size(); i++) { final int fi = i; boolean isStill = false; for (int[] sj : stillJobs) if (sj[0] == fi) isStill = true; if (!isStill) { baseVideo = parts.get(i); break; } }
                final boolean hasBase = baseVideo != null;
                JSONArray voice = job.optJSONArray("voice"), pcm = job.optJSONArray("voicePcm");
                if (voice != null && pcm != null) {   /* 앱이 미리 만든 AI 목소리 (16비트 모노 PCM) */
                    List<byte[]> list = new ArrayList<>();
                    for (int i = 0; i < pcm.length(); i++) { String b = pcm.optString(i, ""); list.add(b.isEmpty() ? null : android.util.Base64.decode(b, android.util.Base64.DEFAULT)); }
                    narration = joinPcm(list, job.optInt("voicePcmRate", 24000), 1);
                    if (hasBase) finalExport(); else nextStill();
                } else if (voice != null) makeNarration(voice, () -> { if (hasBase) finalExport(); else nextStill(); });
                else if (hasBase) finalExport(); else nextStill();
            } catch (Exception e) {
                transformer = null;
                send("error", 0, null, "영상을 만들지 못했습니다: " + e.getMessage());
            }
        });
    }

    /* 사진 한 장 → 1080x1920 영상 (가운데로 천천히 8% 확대) */
    private void nextStill() {
        if (cancelled) return;
        if (stillsDone >= stillJobs.size()) { finalExport(); return; }
        int[] sj = stillJobs.get(stillsDone);
        final long durUs = sj[1] * 1000L;
        try {
            MediaItem mi = new MediaItem.Builder().setUri(Uri.parse(parts.get(sj[0]))).setMimeType(MimeTypes.IMAGE_JPEG).setImageDurationMs(sj[1]).build();
            List<Effect> fx = new ArrayList<>();
            fx.add(Presentation.createForWidthAndHeight(1080, 1920, Presentation.LAYOUT_SCALE_TO_FIT_WITH_CROP));
            fx.add((MatrixTransformation) t -> { android.graphics.Matrix mx = new android.graphics.Matrix(); float k = 1f + 0.08f * Math.min(1f, Math.max(0f, t / (float) durUs)); mx.postScale(k, k); return mx; });
            EditedMediaItem em = new EditedMediaItem.Builder(mi).setFrameRate(30).setEffects(new Effects(ImmutableList.of(), fx)).build();
            File out = new File(act.getCacheDir(), "stillv_" + System.currentTimeMillis() + "_" + stillsDone + ".mp4");
            transformer = new Transformer.Builder(act).setVideoMimeType(MimeTypes.VIDEO_H264)
                    .addListener(new Transformer.Listener() {
                        @Override public void onCompleted(Composition c, ExportResult r) {
                            transformer = null; stillFiles.add(out);
                            parts.set(sj[0], Uri.fromFile(out).toString()); stillsDone++;
                            send("running", Math.round(40f * stillsDone / stillJobs.size()), null, null);
                            nextStill();
                        }
                        @Override public void onError(Composition c, ExportResult r, ExportException e) { transformer = null; cleanup(); send("error", 0, null, "장면 이미지를 영상으로 바꾸지 못했습니다: " + why(e)); }
                    }).build();
            transformer.start(em, out.getAbsolutePath());
        } catch (Exception e) { transformer = null; cleanup(); send("error", 0, null, "장면 이미지를 영상으로 바꾸지 못했습니다: " + e.getMessage()); }
    }

    private void finalExport() {
        try {
            JSONArray subs = job.optJSONArray("subs");
            boolean burn = job.optBoolean("burn", true);
            float size = (float) job.optDouble("size", 58), pos = (float) job.optDouble("pos", -0.62);
            List<EditedMediaItem> items = new ArrayList<>();
            for (int i = 0; i < parts.size(); i++) {
                int stillMs = 0; for (int[] sj : stillJobs) if (sj[0] == i) stillMs = sj[1];
                boolean overStill = stillMs > 0 && baseVideo != null && !parts.get(i).startsWith("file:") ? false : stillMs > 0 && baseVideo != null;
                List<Effect> fx = new ArrayList<>();
                fx.add(Presentation.createForWidthAndHeight(1080, 1920, Presentation.LAYOUT_SCALE_TO_FIT));
                List<TextureOverlay> ov = new ArrayList<>();
                if (overStill) ov.add(new ZoomOverlay(coverBitmap(parts.get(i)), stillMs * 1000L));
                String line = subs != null && i < subs.length() ? subs.optString(i, "").trim() : "";
                if (burn && !line.isEmpty()) {
                    Bitmap bm = subtitleBitmap(line, size);
                    OverlaySettings os = new OverlaySettings.Builder().setBackgroundFrameAnchor(0f, pos).build();
                    ov.add(BitmapOverlay.createStaticBitmapOverlay(bm, os));
                }
                if (!ov.isEmpty()) fx.add(new OverlayEffect(ImmutableList.copyOf(ov)));
                EditedMediaItem.Builder eb;
                if (overStill) {
                    MediaItem mi = new MediaItem.Builder().setUri(Uri.parse(baseVideo))
                            .setClippingConfiguration(new MediaItem.ClippingConfiguration.Builder().setEndPositionMs(stillMs).build()).build();
                    eb = new EditedMediaItem.Builder(mi).setRemoveAudio(true);
                } else {
                    int ms = itemMs(i);
                    MediaItem.Builder mb = new MediaItem.Builder().setUri(Uri.parse(parts.get(i)));
                    if (ms > 0 && stillMs == 0) mb.setClippingConfiguration(new MediaItem.ClippingConfiguration.Builder().setEndPositionMs(ms).build());
                    eb = new EditedMediaItem.Builder(mb.build());
                    if (narration != null && voiceAt(i)) eb.setRemoveAudio(true);   /* 내레이션 샷은 클립 소리를 빼고 목소리만 */
                }
                items.add(eb.setEffects(new Effects(ImmutableList.of(), fx)).build());
            }
            List<EditedMediaItemSequence> seqs = new ArrayList<>();
            seqs.add(new EditedMediaItemSequence(items));
            if (narration != null) seqs.add(new EditedMediaItemSequence(ImmutableList.of(new EditedMediaItem.Builder(MediaItem.fromUri(Uri.fromFile(narration))).build())));
            Composition comp = new Composition.Builder(seqs).experimentalSetForceAudioTrack(true).build();
            outFile = new File(act.getCacheDir(), "assemble_" + System.currentTimeMillis() + ".mp4");
            final int base = stillJobs.isEmpty() ? 0 : 40;
            progBase = base;
            transformer = new Transformer.Builder(act)
                    .setVideoMimeType(MimeTypes.VIDEO_H264)
                    .setAudioMimeType(MimeTypes.AUDIO_AAC)
                    .addListener(new Transformer.Listener() {
                        @Override public void onCompleted(Composition c, ExportResult r) { transformer = null; cleanup(); new Thread(VideoMaker.this::publish).start(); }
                        @Override public void onError(Composition c, ExportResult r, ExportException e) { transformer = null; cleanup(); send("error", 0, null, "영상을 만들지 못했습니다: " + why(e)); }
                    }).build();
            transformer.start(comp, outFile.getAbsolutePath());
            send("running", base, null, null);
            pollProgress();
        } catch (Exception e) {
            transformer = null; cleanup();
            send("error", 0, null, "영상을 만들지 못했습니다: " + e.getMessage());
        }
    }
    private int progBase = 0;
    private static String why(ExportException e) {
        String m = e.getErrorCodeName(); Throwable c = e.getCause();
        if (e.getMessage() != null) m += " · " + e.getMessage();
        if (c != null) m += " · " + c.getClass().getSimpleName() + (c.getMessage() != null ? ": " + c.getMessage() : "");
        return m;
    }
    /* 사진을 1080x1920 에 꽉 차게 잘라 맞춘다 */
    private static Bitmap coverBitmap(String uri) {
        Bitmap src = android.graphics.BitmapFactory.decodeFile(Uri.parse(uri).getPath());
        Bitmap out = Bitmap.createBitmap(1080, 1920, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(out); c.drawColor(Color.BLACK);
        if (src != null) {
            float sc = Math.max(1080f / src.getWidth(), 1920f / src.getHeight());
            float w = src.getWidth() * sc, h = src.getHeight() * sc;
            c.drawBitmap(src, null, new android.graphics.RectF((1080 - w) / 2, (1920 - h) / 2, (1080 + w) / 2, (1920 + h) / 2), new Paint(Paint.FILTER_BITMAP_FLAG));
        }
        return out;
    }
    /* 사진 샷: 바탕 영상 위에 사진을 덮고 천천히 8% 확대 */
    private static class ZoomOverlay extends BitmapOverlay {
        private final Bitmap bm; private final long durUs; private long t0 = -1;
        ZoomOverlay(Bitmap b, long d) { bm = b; durUs = Math.max(1, d); }
        @Override public Bitmap getBitmap(long t) { return bm; }
        @Override public OverlaySettings getOverlaySettings(long t) {
            if (t0 < 0) t0 = t;
            float k = 1f + 0.08f * Math.min(1f, Math.max(0f, (t - t0) / (float) durUs));
            return new OverlaySettings.Builder().setScale(k, k).build();
        }
    }
    private void cleanup() { for (File f : stillFiles) f.delete(); stillFiles.clear(); if (narration != null) { narration.delete(); narration = null; } }

    /* ---------- 내레이션: 기기 음성(TTS)으로 샷마다 한 줄씩 읽어 WAV 하나로 잇는다 ---------- */
    private File narration;
    private int itemMs(int i) {
        try { JSONArray items = job.optJSONArray("items"); if (items != null && i < items.length()) return items.getJSONObject(i).optInt("ms", 0); } catch (Exception ignored) { }
        return 0;
    }
    private boolean voiceAt(int i) { JSONArray v = job.optJSONArray("voice"); return v != null && i < v.length() && !v.optString(i, "").trim().isEmpty(); }

    private android.speech.tts.TextToSpeech tts;
    private void makeNarration(JSONArray voice, Runnable next) {
        final List<File> wavs = new ArrayList<>();
        final String lang = job.optString("voiceLang", "ko-KR");
        tts = new android.speech.tts.TextToSpeech(act, st -> {
            if (st != android.speech.tts.TextToSpeech.SUCCESS) { finishTts(); send("error", 0, null, "휴대폰 음성 엔진을 켜지 못했습니다. 설정 > 접근성 > 텍스트 음성 변환에서 Google 음성 엔진을 고르거나, 내레이션을 끄고 만드세요."); return; }
            int ok = tts.setLanguage(Locale.forLanguageTag(lang));
            if (ok == android.speech.tts.TextToSpeech.LANG_MISSING_DATA || ok == android.speech.tts.TextToSpeech.LANG_NOT_SUPPORTED) { finishTts(); send("error", 0, null, (lang.startsWith("ko") ? "한국어" : "영어") + " 음성 데이터가 없습니다. 설정 > 텍스트 음성 변환 > 음성 데이터 설치에서 받은 뒤 다시 만드세요."); return; }
            tts.setSpeechRate((float) job.optDouble("voiceRate", 1.05));
            tts.setPitch((float) job.optDouble("voicePitch", 1.0));
            tts.setOnUtteranceProgressListener(new android.speech.tts.UtteranceProgressListener() {
                @Override public void onStart(String id) { }
                @Override public void onDone(String id) { main.post(() -> speakNext(voice, wavs, next)); }
                @Override public void onError(String id) { main.post(() -> { wavs.set(wavs.size() - 1, null); speakNext(voice, wavs, next); }); }
            });
            speakNext(voice, wavs, next);
        });
    }
    private void speakNext(JSONArray voice, List<File> wavs, Runnable next) {
        if (cancelled) { finishTts(); return; }
        int i = wavs.size();
        if (i >= voice.length()) { finishTts(); try { narration = joinWavs(wavs); } catch (Exception e) { narration = null; } for (File f : wavs) if (f != null) f.delete(); send("running", 5, null, null); next.run(); return; }
        String line = voice.optString(i, "").trim();
        if (line.isEmpty()) { wavs.add(null); speakNext(voice, wavs, next); return; }
        File f = new File(act.getCacheDir(), "voice_" + System.currentTimeMillis() + "_" + i + ".wav");
        wavs.add(f);
        if (tts.synthesizeToFile(line, null, f, "v" + i) != android.speech.tts.TextToSpeech.SUCCESS) { wavs.set(i, null); speakNext(voice, wavs, next); }
    }
    private void finishTts() { if (tts != null) { try { tts.shutdown(); } catch (Exception ignored) { } tts = null; } }

    /* 샷 i 의 목소리를 그 샷이 시작하는 시각(+0.15초)에 놓는다. 앞 목소리가 길면 끝난 뒤에 이어 읽는다 */
    private File joinWavs(List<File> wavs) throws Exception {
        int rate = 0, ch = 1;
        List<byte[]> pcm = new ArrayList<>();
        for (File f : wavs) {
            if (f == null || !f.exists() || f.length() < 64) { pcm.add(null); continue; }
            byte[] all = java.nio.file.Files.readAllBytes(f.toPath());
            int[] info = wavInfo(all);
            if (info == null) { pcm.add(null); continue; }
            if (rate == 0) { rate = info[0]; ch = info[1]; }
            pcm.add(java.util.Arrays.copyOfRange(all, info[2], Math.min(all.length, info[2] + info[3])));
        }
        if (rate == 0) return null;
        return joinPcm(pcm, rate, ch);
    }
    private File joinPcm(List<byte[]> pcm, int rate, int ch) throws Exception {
        int bps = 2 * ch;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        long slot = 0, total = 0;
        for (int i = 0; i < pcm.size(); i++) {
            int ms = itemMs(i); if (ms <= 0) ms = 5000;
            long start = (slot + 150) * rate / 1000 * bps;
            byte[] b = pcm.get(i);
            if (b != null) {
                if (start > out.size()) out.write(new byte[(int) (start - out.size())]);
                out.write(b);
            }
            slot += ms;
        }
        total = slot * rate / 1000 * bps;
        if (out.size() < total) out.write(new byte[(int) (total - out.size())]);
        byte[] data = java.util.Arrays.copyOf(out.toByteArray(), (int) total);
        File w = new File(act.getCacheDir(), "narration_" + System.currentTimeMillis() + ".wav");
        try (java.io.FileOutputStream os = new java.io.FileOutputStream(w)) { os.write(wavHeader(data.length, rate, ch)); os.write(data); }
        return w;
    }
    /* {표본율, 채널, 데이터 시작, 데이터 길이}. 16비트 PCM 만 받는다 */
    private static int[] wavInfo(byte[] b) {
        if (b.length < 44 || b[0] != 'R' || b[8] != 'W') return null;
        int pos = 12, rate = 0, ch = 1, bits = 16;
        while (pos + 8 <= b.length) {
            String id = new String(b, pos, 4, java.nio.charset.StandardCharsets.US_ASCII);
            int size = le32(b, pos + 4);
            if (id.equals("fmt ")) { ch = le16(b, pos + 10); rate = le32(b, pos + 12); bits = le16(b, pos + 22); }
            else if (id.equals("data")) { if (bits != 16 || rate == 0) return null; return new int[]{rate, ch, pos + 8, size <= 0 || pos + 8 + size > b.length ? b.length - pos - 8 : size}; }
            pos += 8 + size + (size & 1);
        }
        return null;
    }
    private static int le16(byte[] b, int o) { return (b[o] & 0xff) | (b[o + 1] & 0xff) << 8; }
    private static int le32(byte[] b, int o) { return (b[o] & 0xff) | (b[o + 1] & 0xff) << 8 | (b[o + 2] & 0xff) << 16 | (b[o + 3] & 0xff) << 24; }
    private static byte[] wavHeader(int len, int rate, int ch) {
        java.nio.ByteBuffer h = java.nio.ByteBuffer.allocate(44).order(java.nio.ByteOrder.LITTLE_ENDIAN);
        h.put("RIFF".getBytes()).putInt(36 + len).put("WAVE".getBytes()).put("fmt ".getBytes()).putInt(16).putShort((short) 1).putShort((short) ch)
         .putInt(rate).putInt(rate * ch * 2).putShort((short) (ch * 2)).putShort((short) 16).put("data".getBytes()).putInt(len);
        return h.array();
    }

    private void pollProgress() {
        main.postDelayed(() -> {
            if (transformer == null) return;
            ProgressHolder ph = new ProgressHolder();
            if (transformer.getProgress(ph) == Transformer.PROGRESS_STATE_AVAILABLE) send("running", progBase + Math.round(ph.progress * (100 - progBase) / 100f), null, null);
            pollProgress();
        }, 700);
    }

    /* 만든 파일을 동영상 앱(Movies/ShortFormMaker)에 옮긴다 */
    private void publish() {
        try {
            ContentValues v = new ContentValues();
            String name = title.replaceAll("[\\\\/:*?\"<>|]", "_") + "_assembled_" + System.currentTimeMillis() + ".mp4";
            v.put(MediaStore.Video.Media.DISPLAY_NAME, name);
            v.put(MediaStore.Video.Media.MIME_TYPE, "video/mp4");
            Uri uri;
            if (android.os.Build.VERSION.SDK_INT >= 29) {
                v.put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/ShortFormMaker");
                uri = act.getContentResolver().insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, v);
            } else {
                uri = android.net.Uri.fromFile(outFile);
            }
            if (uri != null && android.os.Build.VERSION.SDK_INT >= 29) {
                try (InputStream in = new FileInputStream(outFile); OutputStream os = act.getContentResolver().openOutputStream(uri)) {
                    byte[] buf = new byte[1 << 16]; int n;
                    while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
                }
                outFile.delete();
            }
            send("done", 100, uri == null ? null : uri.toString(), null);
        } catch (Exception e) { send("error", 0, null, "영상을 저장하지 못했습니다: " + e.getMessage()); }
    }

    /* 흰 글씨 + 검은 테두리, 최대 두 줄로 감싸는 자막 그림 */
    private static Bitmap subtitleBitmap(String text, float size) {
        int w = 940;
        TextPaint fill = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        fill.setTextSize(size); fill.setColor(Color.WHITE); fill.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        TextPaint stroke = new TextPaint(fill);
        stroke.setStyle(Paint.Style.STROKE); stroke.setStrokeWidth(size * 0.16f); stroke.setColor(Color.BLACK); stroke.setStrokeJoin(Paint.Join.ROUND);
        StaticLayout lf = StaticLayout.Builder.obtain(text, 0, text.length(), fill, w).setAlignment(Layout.Alignment.ALIGN_CENTER).setMaxLines(3).build();
        StaticLayout ls = StaticLayout.Builder.obtain(text, 0, text.length(), stroke, w).setAlignment(Layout.Alignment.ALIGN_CENTER).setMaxLines(3).build();
        int h = lf.getHeight() + (int) (size * 0.4f);
        Bitmap bm = Bitmap.createBitmap(w + 40, h, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bm);
        c.translate(20, size * 0.2f);
        ls.draw(c); lf.draw(c);
        return bm;
    }

    private void send(String state, int progress, String uri, String error) {
        try {
            JSONObject o = new JSONObject();
            if (!"running".equals(state)) active = false;
            o.put("state", state); o.put("progress", progress);
            if (uri != null) o.put("uri", uri);
            if (error != null) o.put("error", error);
            if (cb != null) cb.send(o);
        } catch (Exception ignored) { }
    }
}
