// ==UserScript==
// @name                  bilibili_script
// @namespace             bilibili_script
// @version               0.21
// @description           auto change bilibili video playback rate
// @description:zh-CN     哔哩哔哩 (゜-゜)つロ 干杯~-bilibili
// @author                萤火FyrGlow, sc
// @match                 https://www.bilibili.com/video/*
// @match                 https://www.bilibili.com/bangumi/play/*
// @match                 https://www.bilibili.com/cheese/play/*
// @match                 https://www.bilibili.com/list/*
// @icon                  https://static.hdslb.com/images/favicon.ico
// @homepage              https://github.com/12471220
// @grant                 none
// @license               BSD
// @updateURL             https://raw.githubusercontent.com/12471220/web-bilibili-script/refs/heads/master/main.js
// @downloadURL           https://raw.githubusercontent.com/12471220/web-bilibili-script/refs/heads/master/main.js
// ==/UserScript==

(() => {
  "use strict";

  /** 样式注入 */
  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
    .bpx-player-ctrl-playbackrate.bpx-state-show .bpx-player-ctrl-playbackrate-menu {
      display: grid !important;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      width: 180px;
      padding: 6px;
      box-sizing: border-box;
    }
    .bpx-player-ctrl-playbackrate-menu { display: none; }
    `;
    document.head.appendChild(style);
  }

  /** 页面识别 */
  function getPageType() {
    if (location.href.includes("/video/")) return "video";
    if (location.href.includes("/bangumi/")) return "bangumi";
    if (location.href.includes("/cheese/")) return "cheese";
    if (location.href.includes("/list/")) return "list";
    return "unknown";
  }
  /** 存储管理 */
  const RateStorage = {
    _rateKey: null,
    _rateItemKey: [],

    init() {
      const pageType = getPageType();
      this._rateKey = `web-bilibili-script_rate_${pageType}`;
      this._rateItemKey = defaultRates.map(
        (_, i) => `web-bilibili-script_rate_item_${pageType}_${i}`,
      );
      return this;
    },

    saveRate(rate) {
      localStorage.setItem(this._rateKey, rate);
      console.log(`[web-bilibili-script] 当前倍速已保存：${rate}x`);
    },
    loadRate() {
      const r = parseFloat(localStorage.getItem(this._rateKey));
      return isNaN(r) ? 1.0 : r;
    },
    saveRateItem(index, rate) {
      localStorage.setItem(this._rateItemKey[index], rate);
    },
    loadRateItems() {
      return defaultRates.map((rate, index) => {
        const r = parseFloat(localStorage.getItem(this._rateItemKey[index]));
        return isNaN(r) ? rate : r;
      });
    },
  };

  /** 默认倍速 */
  const defaultRates = [3, 2, 1.8, 1.5, 1.3, 1.2, 1, 0.5, 0.07];

  /** DOM工具 */
  const DOM = {
    getVideo() {
      return document.querySelector("video");
    },
    getMenu() {
      return document.querySelector(".bpx-player-ctrl-playbackrate-menu");
    },
    getResult() {
      return document.querySelector(".bpx-player-ctrl-playbackrate-result");
    },
    getVolBtn() {
      return document.querySelector(".bpx-player-ctrl-volume");
    },
    clearMenu(menu) {
      menu.innerHTML = "";
    },
  };

  /** 倍速显示 */
  function formatRate(rate) {
    return (rate % 1 ? rate : rate.toFixed(1)) + "x";
  }

  /** 倍速菜单 */
  function createMenuItem(rate, index, video, result) {
    const item = document.createElement("li");
    item.className = "bpx-player-ctrl-playbackrate-menu-item";
    item.dataset.value = rate;
    item.dataset.index = index;
    item.textContent = formatRate(rate);

    if (Math.abs(rate - video.playbackRate) < 0.001) {
      item.classList.add("bpx-state-active");
      result.textContent = rate === 1 ? "倍速" : formatRate(rate);
    }

    /** 点击切换 */
    item.addEventListener("click", () => {
      const newRate = parseFloat(item.dataset.value);
      video.playbackRate = newRate;
      result.textContent = newRate === 1 ? "倍速" : formatRate(newRate);
      item.parentElement
        .querySelectorAll("li")
        .forEach((el) => el.classList.remove("bpx-state-active"));
      item.classList.add("bpx-state-active");
      RateStorage.saveRate(newRate);
      console.log(`[web-bilibili-script] 倍速已设置为：${newRate}x`);
    });

    /** 右键编辑 */
    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (item.querySelector("input")) return;
      const currentRate = parseFloat(item.dataset.value);
      item.textContent = "";
      const input = document.createElement("input");
      input.type = "number";
      input.step = "0.01";
      input.min = "0.07";
      input.max = "16";
      input.value = currentRate;
      input.style.cssText =
        "width:60px;font-size:inherit;text-align:center;background:#212121;color:inherit;border:1px solid #ccc;border-radius:4px";

      function applyInput() {
        let newRate = parseFloat(input.value);
        if (isNaN(newRate) || newRate < 0.07) newRate = 0.07;
        if (newRate > 16) newRate = 16;
        newRate = Math.round(newRate * 100) / 100;
        const displayRate =
          Math.floor(newRate * 10) === newRate * 10
            ? newRate.toFixed(1)
            : newRate.toString();
        item.dataset.value = newRate;
        item.textContent = displayRate + "x";
        RateStorage.saveRateItem(item.dataset.index, newRate);
        console.log(`[web-bilibili-script] 新的倍速选项已保存：${newRate}x`);
      }

      input.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter") applyInput();
      });
      input.addEventListener("blur", applyInput);

      item.appendChild(input);
      input.focus();
      input.select();
    });

    return item;
  }

  /** 注入菜单 */
  function injectSpeedMenu() {
    const menu = DOM.getMenu();
    const result = DOM.getResult();
    const video = DOM.getVideo();
    if (!menu || !result || !video) return false;

    DOM.clearMenu(menu);

    const savedRate = RateStorage.loadRate();
    if (Math.abs(video.playbackRate - savedRate) > 0.001) {
      video.playbackRate = savedRate;
      console.log(`[web-bilibili-script] 已应用保存的倍速：${savedRate}x`);
    }

    const customRates = RateStorage.loadRateItems();
    customRates.forEach((rate, index) =>
      menu.appendChild(createMenuItem(rate, index, video, result)),
    );

    // it is useless.
    //bindRateWheelControl();
    //console.log("[web-bilibili-script] 自定义倍速菜单已注入！");
    return true;
  }

  /** 滚轮调速 */
  function bindRateWheelControl() {
    const rateBtn = document.querySelector(".bpx-player-ctrl-playbackrate");
    if (!rateBtn) return;
    rateBtn.removeEventListener("wheel", handleRateWheel);
    rateBtn.addEventListener("wheel", handleRateWheel, { passive: false });
  }

  function handleRateWheel(event) {
    event.preventDefault();
    const video = DOM.getVideo();
    if (!video) return;

    let rate = Math.floor(video.playbackRate * 10) / 10;
    rate += event.deltaY < 0 ? 0.1 : -0.1;
    rate = Math.min(16, Math.max(0.1, parseFloat(rate.toFixed(1))));

    video.playbackRate = rate;

    const result = DOM.getResult();
    if (result)
      result.textContent = rate === 1 ? "倍速" : rate.toFixed(1) + "x";

    RateStorage.saveRate(rate);
    console.log(`[web-bilibili-script] 滚轮调节倍速：${rate}x`);
  }

  /** 按键调速 */
  function bindKeyControls() {
    let lastSavedRate = RateStorage.loadRate();
    document.addEventListener("keydown", (event) => {
      const video = DOM.getVideo();
      if (!video) return;

      let rate = video.playbackRate;

      if (event.shiftKey && event.code === "KeyX") {
        rate = Math.max(0.1, rate - 0.1);
      } else if (event.shiftKey && event.code === "KeyC") {
        rate = Math.min(16, rate + 0.1); // max speed is 16x
      } else if (event.shiftKey && event.code === "KeyZ") {
        // switch toggle between 1x and saved rate
        if (Math.abs(rate - 1) < 0.001) {
          rate = lastSavedRate || 1;
        } else {
          lastSavedRate = rate;
          rate = 1;
        }
        // only save one decimal.
        rate = Math.floor(rate * 10) / 10;
        video.playbackRate = rate;
        const result = DOM.getResult();
        if (result) {
          result.textContent = rate === 1 ? "倍速" : rate.toFixed(1) + "x";
        }
        console.log(`[web-bilibili-script] 快捷键调节倍速：${rate}x`);
        return;
      } else return;

      rate = Math.round(rate * 10) / 10;
      video.playbackRate = rate;

      const result = DOM.getResult();
      if (result) {
        result.textContent = rate === 1 ? "倍速" : rate.toFixed(1) + "x";
      }

      RateStorage.saveRate(rate);
      console.log(`[web-bilibili-script] 快捷键调节倍速：${rate}x`);
    });
  }

  /** 音量增强 */
  function initBiliGain() {
    const video = DOM.getVideo();
    if (!video) {
      console.log("[web-bilibili-script] [Audio] 未找到 video 元素！");
      return;
    }

    if (!window._BiliAudioCtx) {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      gain.gain.value = 0;

      window._BiliAudioCtx = ctx;
      window._BiliGainNode = gain;
      window._BiliVolumeDB = 0;

      console.log("[web-bilibili-script] [Audio] 初始化完成！");
    }

    const gain = window._BiliGainNode;
    let lastBiliVolume = video.volume;
    const volBtn = DOM.getVolBtn();
    if (!volBtn) return;
    const volumeNumElem = volBtn.querySelector(
      ".bpx-player-ctrl-volume-number",
    );

    let lastSrc = video.currentSrc;
    let PATimer = null;

    const Max_dB = 99;
    function dbToLinearGain(db) {
      return db <= 0 ? 0 : Math.pow(10, db / 20) - 1;
    }

    function bindAudio() {
      const checkAudio = () => {
        const stream = video.captureStream();
        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) return false;

        const src = window._BiliAudioCtx.createMediaStreamSource(
          new MediaStream([audioTrack]),
        );
        src.connect(gain).connect(window._BiliAudioCtx.destination);
        return true;
      };

      if (PATimer) clearInterval(PATimer);
      PATimer = setInterval(() => {
        if (checkAudio()) {
          clearInterval(PATimer);
          PATimer = null;
        }
      }, 200);
    }

    bindAudio();

    const originalFontSize = parseFloat(
      window.getComputedStyle(volumeNumElem).fontSize,
    );

    function updateDisplay(vol, db) {
      if (vol >= 100 && db > 0) {
        volumeNumElem.innerText = `${db}dB`;
        volumeNumElem.style.fontSize = originalFontSize - 1 + "px";
      } else {
        volumeNumElem.innerText = vol;
        volumeNumElem.style.fontSize = originalFontSize + "px";
      }
    }

    setInterval(() => {
      if (video.currentSrc !== lastSrc) {
        console.log(
          "[web-bilibili-script] [Audio] 检测到视频源变化:",
          video.currentSrc,
        );
        lastSrc = video.currentSrc;
        window._BiliVolumeDB = 0;
        gain.gain.value = 0;
        lastBiliVolume = video.volume;
        updateDisplay(Math.round(video.volume * 100), 0);
        bindAudio();
      }

      if (video.volume !== lastBiliVolume) {
        window._BiliVolumeDB = 0;
        gain.gain.value = 0;
        lastBiliVolume = video.volume;
        updateDisplay(Math.round(video.volume * 100), 0);
      }
    }, 100);

    if (!volBtn._biliWheelBound) {
      volBtn.addEventListener("wheel", (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1 : -1;
        let currentVolume = Math.round(video.volume * 100);

        if (currentVolume >= 100) {
          if (delta > 0) {
            window._BiliVolumeDB = Math.min(Max_dB, window._BiliVolumeDB + 1);
          } else {
            if (window._BiliVolumeDB > 0) {
              window._BiliVolumeDB = Math.max(0, window._BiliVolumeDB - 1);
            } else {
              currentVolume = Math.max(0, currentVolume - 5);
              video.volume = currentVolume / 100;
            }
          }
          gain.gain.value = dbToLinearGain(window._BiliVolumeDB);
        } else {
          currentVolume = Math.min(100, Math.max(0, currentVolume + delta * 5));
          video.volume = currentVolume / 100;
        }

        updateDisplay(currentVolume, window._BiliVolumeDB);
        lastBiliVolume = video.volume;
      });
      volBtn._biliWheelBound = true;
    }
  }

  /** 页面监听 */
  function bindPageNavObserver() {
    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        console.log(
          "[web-bilibili-script] 检测到页面切换，重新注入倍速设置...",
        );
        setTimeout(() => {
          injectSpeedMenu();
        }, 1000);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  /** 初始注入 */
  function startInjection() {
    const observer = new MutationObserver(() => {
      if (injectSpeedMenu()) {
        observer.disconnect();
        const volObserver = new MutationObserver((mutations, obs) => {
          const volBtn = document.querySelector(".bpx-player-ctrl-volume");
          if (volBtn) {
            obs.disconnect();
            initBiliGain();
          }
        });
        volObserver.observe(document.body, { childList: true, subtree: true });
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  /** 主入口 */
  function main() {
    injectStyles();

    RateStorage.init();

    bindKeyControls();
    bindPageNavObserver();
    startInjection();
  }

  main();
})();
