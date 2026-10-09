(() => {
  "use strict";
  const tr = text => window.SmartActionLanguage?.tr(text) || text;
  const websiteMode = location.protocol === "http:" || location.protocol === "https:";
  document.querySelectorAll("iframe[data-youtube-id]").forEach(frame => {
    const id = frame.dataset.youtubeId;
    const wrapper = frame.closest(".sa-video");
    if (!wrapper || !/^[A-Za-z0-9_-]{11}$/.test(id || "")) return;
    if (websiteMode) {
      const url = new URL(frame.dataset.youtubeSrc);
      // Use the actual host page, including its scheme and port.
      url.searchParams.set("origin", location.origin);
      url.searchParams.set("playsinline", "1");
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.src = url.href;
      return;
    }
    frame.remove();
    const message = document.createElement("div");
    message.className = "sa-video-local";
    const title = document.createElement("p");
    title.className = "sa-video-local-title";
    title.textContent = frame.title || tr("YouTube 影片");
    const explanation = document.createElement("p");
    explanation.textContent = tr("要在頁內播放，請先啟動本機網站，或使用已發布的網站網址。");
    const help = document.createElement("a");
    help.href = wrapper.dataset.videoHelp;
    help.textContent = tr("查看影片播放方式");
    message.append(title, explanation, help);
    wrapper.append(message);
  });
})();
