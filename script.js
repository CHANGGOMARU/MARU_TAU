const copyButton = document.querySelector("#copyCredit");
const creditText = document.querySelector("#creditText");
const copyStatus = document.querySelector("#copyStatus");
const sampleStorageKey = "manuSamplesDraft";
const termsStorageKey = "manuTermsVisited";

const hasVisitedTerms = () => {
  try {
    return localStorage.getItem(termsStorageKey) === "true";
  } catch {
    return false;
  }
};

const markTermsVisited = () => {
  try {
    localStorage.setItem(termsStorageKey, "true");
  } catch {
    // Ignore storage failures; the download page will keep the gate closed.
  }
};

const checkDownloadFile = async (url) => {
  try {
    const headResponse = await fetch(url, {
      method: "HEAD",
      cache: "no-store"
    });

    if (headResponse.ok) {
      return true;
    }

    if (headResponse.status !== 405) {
      return false;
    }
  } catch {
    // Fall back to GET below for hosts that do not support HEAD.
  }

  try {
    const getResponse = await fetch(url, { cache: "no-store" });
    return getResponse.ok;
  } catch {
    return false;
  }
};

const getDefaultSamples = () =>
  Array.isArray(window.MANU_SAMPLES) ? window.MANU_SAMPLES : [];

const normalizeYouTubeUrl = (value) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    let videoId = "";

    if (url.hostname.includes("youtu.be")) {
      videoId = url.pathname.split("/").filter(Boolean)[0] || "";
    } else if (url.pathname.includes("/embed/")) {
      videoId = url.pathname.split("/embed/")[1].split("/")[0] || "";
    } else {
      videoId = url.searchParams.get("v") || "";
    }

    if (!videoId) {
      return trimmed;
    }

    const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
    const list = url.searchParams.get("list");

    if (list) {
      embedUrl.searchParams.set("list", list);
    }

    return embedUrl.toString();
  } catch {
    return trimmed;
  }
};

const readSampleDrafts = () => {
  try {
    const raw = localStorage.getItem(sampleStorageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getSamples = () => readSampleDrafts() || getDefaultSamples();

const buildSampleDataJs = (samples) =>
  `window.MANU_SAMPLES = ${JSON.stringify(samples, null, 2)};\n`;

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const downloadTextFile = async (fileName, text) => {
  if ("showSaveFilePicker" in window) {
    const handle = await window.showSaveFilePicker({
      suggestedName: fileName,
      types: [
        {
          description: "JavaScript file",
          accept: { "text/javascript": [".js"] }
        }
      ]
    });
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    return;
  }

  const blob = new Blob([text], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

document.querySelectorAll(".site-nav a").forEach((link) => {
  link.addEventListener("click", (event) => {
    const url = new URL(link.href, window.location.href);
    const current = new URL(window.location.href);

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      url.origin !== current.origin ||
      link.target ||
      link.hasAttribute("download") ||
      (url.pathname === current.pathname && url.hash)
    ) {
      return;
    }

    event.preventDefault();

    if (url.pathname === current.pathname && !url.hash) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    document.documentElement.classList.add("is-glitching");
    document.body.classList.add("is-leaving");
    window.setTimeout(() => {
      window.location.href = url.href;
    }, 220);
  });
});

if (window.location.pathname.endsWith("terms.html")) {
  markTermsVisited();
}

const gatedDownload = document.querySelector("[data-requires-terms='true']");
const downloadGateStatus = document.querySelector("#downloadGateStatus");

if (gatedDownload && downloadGateStatus) {
  let canDownload = false;
  let shouldRedirectToTerms = false;

  const lockDownload = (message, redirectToTerms = false) => {
    canDownload = false;
    shouldRedirectToTerms = redirectToTerms;
    gatedDownload.setAttribute("aria-disabled", "true");
    downloadGateStatus.textContent = message;
  };

  const unlockDownload = (message) => {
    canDownload = true;
    shouldRedirectToTerms = false;
    gatedDownload.removeAttribute("aria-disabled");
    downloadGateStatus.textContent = message;
  };

  gatedDownload.addEventListener("click", (event) => {
    if (!canDownload) {
      event.preventDefault();
      if (shouldRedirectToTerms) {
        window.location.href = "terms.html";
      }
    }
  });

  if (!hasVisitedTerms()) {
    lockDownload("이용 약관 페이지를 한 번 확인해야 다운로드할 수 있습니다.", true);
  } else {
    lockDownload("다운로드 파일을 확인하는 중입니다.");
    checkDownloadFile(gatedDownload.href).then((exists) => {
      if (exists) {
        unlockDownload("이용 약관 확인 기록이 있고 다운로드 파일이 준비되어 있습니다.");
      } else {
        lockDownload("다운로드 파일이 아직 업로드되지 않았습니다.");
      }
    });
  }
}

if (copyButton && creditText && copyStatus) {
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(creditText.textContent.trim());
      copyStatus.textContent = "크레딧을 복사했습니다.";
    } catch {
      copyStatus.textContent = "복사에 실패했습니다. 텍스트를 직접 선택해 주세요.";
    }
  });
}

const sampleList = document.querySelector("#sampleList");

if (sampleList) {
  const samples = getSamples();
  sampleList.innerHTML = samples
    .map(
      (sample) => `
        <article class="demo-panel sample-card">
          <div class="video-frame">
            <iframe
              width="560"
              height="315"
              src="${escapeHtml(sample.youtubeUrl)}"
              title="${escapeHtml(sample.title)}"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerpolicy="strict-origin-when-cross-origin"
              allowfullscreen
            ></iframe>
          </div>
          <div class="sample-card-body">
            <h2>${escapeHtml(sample.title)}</h2>
            <p>${escapeHtml(sample.description)}</p>
            ${sample.credit ? `<span class="sample-card-meta">${escapeHtml(sample.credit)}</span>` : ""}
          </div>
        </article>
      `
    )
    .join("");
}

const sampleForm = document.querySelector("#sampleForm");

if (sampleForm) {
  const fields = {
    title: document.querySelector("#sampleTitle"),
    youtubeUrl: document.querySelector("#sampleUrl"),
    description: document.querySelector("#sampleDescription"),
    credit: document.querySelector("#sampleCredit")
  };
  const list = document.querySelector("#adminSampleList");
  const count = document.querySelector("#sampleCount");
  const exportBox = document.querySelector("#sampleExport");
  const status = document.querySelector("#sampleAdminStatus");
  const resetButton = document.querySelector("#resetSampleForm");
  const copyButton = document.querySelector("#copySampleData");
  const saveButton = document.querySelector("#saveSampleData");
  const clearButton = document.querySelector("#clearLocalSamples");
  let samples = getSamples().map((sample) => ({ ...sample }));
  let editingIndex = -1;

  const setStatus = (message) => {
    status.textContent = message;
  };

  const persist = () => {
    localStorage.setItem(sampleStorageKey, JSON.stringify(samples));
  };

  const resetForm = () => {
    editingIndex = -1;
    sampleForm.reset();
    document.querySelector("#saveSample").textContent = "샘플 추가";
  };

  const refresh = () => {
    count.textContent = `${samples.length}개`;
    exportBox.value = buildSampleDataJs(samples);
    list.innerHTML = samples
      .map(
        (sample, index) => `
          <article class="admin-sample-item">
            <div>
              <h3>${escapeHtml(sample.title)}</h3>
              <p>${escapeHtml(sample.description || "설명 없음")}</p>
              <p>${escapeHtml(sample.youtubeUrl)}</p>
            </div>
            <div class="admin-item-actions">
              <button class="button secondary" type="button" data-action="edit" data-index="${index}">수정</button>
              <button class="button ghost dark" type="button" data-action="up" data-index="${index}">위로</button>
              <button class="button ghost dark" type="button" data-action="down" data-index="${index}">아래로</button>
              <button class="button primary" type="button" data-action="delete" data-index="${index}">삭제</button>
            </div>
          </article>
        `
      )
      .join("");
  };

  sampleForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const sample = {
      title: fields.title.value.trim(),
      youtubeUrl: normalizeYouTubeUrl(fields.youtubeUrl.value),
      description: fields.description.value.trim(),
      credit: fields.credit.value.trim()
    };

    if (editingIndex >= 0) {
      samples[editingIndex] = sample;
      setStatus("샘플을 수정했습니다.");
    } else {
      samples.push(sample);
      setStatus("샘플을 추가했습니다.");
    }

    persist();
    resetForm();
    refresh();
  });

  resetButton.addEventListener("click", resetForm);

  list.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");

    if (!button) {
      return;
    }

    const index = Number(button.dataset.index);
    const action = button.dataset.action;

    if (action === "edit") {
      const sample = samples[index];
      editingIndex = index;
      fields.title.value = sample.title;
      fields.youtubeUrl.value = sample.youtubeUrl;
      fields.description.value = sample.description || "";
      fields.credit.value = sample.credit || "";
      document.querySelector("#saveSample").textContent = "샘플 수정";
      setStatus("수정할 샘플을 불러왔습니다.");
      return;
    }

    if (action === "delete") {
      samples.splice(index, 1);
    }

    if (action === "up" && index > 0) {
      [samples[index - 1], samples[index]] = [samples[index], samples[index - 1]];
    }

    if (action === "down" && index < samples.length - 1) {
      [samples[index + 1], samples[index]] = [samples[index], samples[index + 1]];
    }

    persist();
    resetForm();
    refresh();
  });

  copyButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(exportBox.value);
    setStatus("sample-data.js 내용을 복사했습니다.");
  });

  saveButton.addEventListener("click", async () => {
    try {
      await downloadTextFile("sample-data.js", exportBox.value);
      setStatus("sample-data.js 파일을 저장했습니다.");
    } catch {
      setStatus("파일 저장을 취소했습니다.");
    }
  });

  clearButton.addEventListener("click", () => {
    localStorage.removeItem(sampleStorageKey);
    samples = getDefaultSamples().map((sample) => ({ ...sample }));
    resetForm();
    refresh();
    setStatus("임시 저장 데이터를 삭제했습니다.");
  });

  refresh();
}
