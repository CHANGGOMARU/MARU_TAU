const copyButton = document.querySelector("#copyCredit");
const creditText = document.querySelector("#creditText");
const copyStatus = document.querySelector("#copyStatus");
const sampleStorageKey = "manuSamplesDraft";
const downloadStorageKey = "manuDownloadsDraft";
const termsStorageKey = "manuTermsAcceptedRelease";

const hasVisitedTerms = () => {
  try {
    return localStorage.getItem(termsStorageKey) === getLatestDownloadKey();
  } catch {
    return false;
  }
};

const markTermsVisited = () => {
  try {
    localStorage.setItem(termsStorageKey, getLatestDownloadKey());
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

const getDownloadFileNames = () =>
  Array.isArray(window.MANU_DOWNLOAD_FILES) ? window.MANU_DOWNLOAD_FILES : [];

const readDownloadDrafts = () => {
  try {
    const raw = localStorage.getItem(downloadStorageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getDownloads = () => readDownloadDrafts() || getDownloadFileNames();

const buildDownloadDataJs = (fileNames) =>
  `window.MANU_DOWNLOAD_FILES = ${JSON.stringify(fileNames, null, 2)};\n`;

const parseVersionParts = (fileName) => {
  const version = fileName.match(/v?(\d+(?:[._-]\d+)*)/i)?.[1] || "0";
  return version.split(/[._-]/).map((part) => Number(part) || 0);
};

const compareVersionParts = (a, b) => {
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (b[index] || 0) - (a[index] || 0);

    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
};

const getSortedDownloadFiles = () =>
  getDownloads()
    .filter((fileName) => typeof fileName === "string" && fileName.trim())
    .map((fileName) => fileName.trim())
    .filter((fileName, index, fileNames) => fileNames.indexOf(fileName) === index)
    .map((fileName) => ({
      fileName,
      href: `../downloads/${encodeURIComponent(fileName)}`,
      versionParts: parseVersionParts(fileName)
    }))
    .sort((a, b) => compareVersionParts(a.versionParts, b.versionParts) || b.fileName.localeCompare(a.fileName));

const getLatestDownloadKey = () => getSortedDownloadFiles()[0]?.fileName || "no-download-file";

const getDownloadLabel = (fileName) => {
  const version = fileName.match(/v?(\d+(?:[._-]\d+)*)/i)?.[0] || fileName.replace(/\.zip$/i, "");
  return `MANU ${version.replaceAll("_", ".")} ZIP 다운로드`;
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

const currentPath = window.location.pathname.replace(/\/+$/, "");

if (currentPath.endsWith("/terms")) {
  markTermsVisited();
}

const downloadList = document.querySelector("#downloadList");
const downloadGateStatus = document.querySelector("#downloadGateStatus");

if (downloadList && downloadGateStatus) {
  const downloads = getSortedDownloadFiles();
  const termsAccepted = hasVisitedTerms();

  if (!downloads.length) {
    downloadGateStatus.textContent = "등록된 다운로드 파일이 없습니다.";
  } else if (!termsAccepted) {
    downloadGateStatus.textContent =
      "최신 버전 기준 이용 약관을 한 번 확인해야 다운로드할 수 있습니다.";
  } else {
    downloadGateStatus.textContent = "다운로드 파일을 확인하는 중입니다.";
  }

  downloadList.innerHTML = downloads
    .map(
      (item, index) => `
        <article class="download-item${index === 0 ? " is-latest" : ""}">
          <div>
            <span class="download-version">${index === 0 ? "최신 버전" : "구버전"}</span>
            <h2>${escapeHtml(getDownloadLabel(item.fileName))}</h2>
            <p>${escapeHtml(item.fileName)}</p>
          </div>
          <a
            class="button primary"
            href="${escapeHtml(item.href)}"
            download
            data-download-file="${escapeHtml(item.fileName)}"
            aria-disabled="true"
          >
            다운로드
          </a>
        </article>
      `
    )
    .join("");

  const downloadLinks = [...downloadList.querySelectorAll("[data-download-file]")];
  const unavailableFiles = new Set(downloads.map((item) => item.fileName));

  downloadLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!termsAccepted) {
        event.preventDefault();
        window.location.href = "../terms/";
        return;
      }

      if (unavailableFiles.has(link.dataset.downloadFile)) {
        event.preventDefault();
      }
    });
  });

  if (termsAccepted) {
    Promise.all(
      downloads.map(async (item) => ({
        ...item,
        exists: await checkDownloadFile(item.href)
      }))
    ).then((checkedDownloads) => {
      checkedDownloads.forEach((item) => {
        const link = downloadList.querySelector(`[data-download-file="${CSS.escape(item.fileName)}"]`);

        if (!link) {
          return;
        }

        if (item.exists) {
          unavailableFiles.delete(item.fileName);
          link.removeAttribute("aria-disabled");
        } else {
          link.setAttribute("aria-disabled", "true");
          link.textContent = "파일 없음";
        }
      });

      if (unavailableFiles.size === checkedDownloads.length) {
        downloadGateStatus.textContent = "다운로드 파일이 아직 업로드되지 않았습니다.";
      } else if (unavailableFiles.size) {
        downloadGateStatus.textContent = "일부 파일이 아직 업로드되지 않았습니다.";
      } else {
        downloadGateStatus.textContent = "이용 약관 확인 기록이 있고 다운로드 파일이 준비되어 있습니다.";
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

const downloadForm = document.querySelector("#downloadForm");

if (downloadForm) {
  const fileNameField = document.querySelector("#downloadFileName");
  const bulkForm = document.querySelector("#bulkDownloadForm");
  const bulkInput = document.querySelector("#downloadBulkInput");
  const list = document.querySelector("#adminDownloadList");
  const count = document.querySelector("#downloadFileCount");
  const exportBox = document.querySelector("#downloadExport");
  const status = document.querySelector("#downloadAdminStatus");
  const folderButton = document.querySelector("#readDownloadFolder");
  const folderInput = document.querySelector("#downloadFolderInput");
  const resetButton = document.querySelector("#resetDownloadForm");
  const copyButton = document.querySelector("#copyDownloadData");
  const saveButton = document.querySelector("#saveDownloadData");
  const clearButton = document.querySelector("#clearLocalDownloads");
  let downloads = getDownloads().map((fileName) => String(fileName).trim()).filter(Boolean);
  let editingIndex = -1;

  const setStatus = (message) => {
    status.textContent = message;
  };

  const getSortedFileNames = () =>
    downloads
      .filter((fileName, index, fileNames) => fileNames.indexOf(fileName) === index)
      .sort((a, b) => compareVersionParts(parseVersionParts(a), parseVersionParts(b)) || b.localeCompare(a));

  const persist = () => {
    localStorage.setItem(downloadStorageKey, JSON.stringify(downloads));
  };

  const resetForm = () => {
    editingIndex = -1;
    downloadForm.reset();
    document.querySelector("#saveDownloadFile").textContent = "파일명 추가";
  };

  const refresh = () => {
    downloads = getSortedFileNames();
    count.textContent = `${downloads.length}개`;
    exportBox.value = buildDownloadDataJs(downloads);
    list.innerHTML = downloads
      .map(
        (fileName, index) => `
          <article class="admin-sample-item">
            <div>
              <h3>${escapeHtml(index === 0 ? "최신 버전" : "구버전")}</h3>
              <p>${escapeHtml(fileName)}</p>
            </div>
            <div class="admin-item-actions">
              <button class="button secondary" type="button" data-download-action="edit" data-index="${index}">수정</button>
              <button class="button primary" type="button" data-download-action="delete" data-index="${index}">삭제</button>
            </div>
          </article>
        `
      )
      .join("");
  };

  const replaceWithLocalFiles = (fileNames) => {
    const zipFileNames = fileNames
      .map((fileName) => fileName.split(/[\\/]/).pop().trim())
      .filter((fileName) => fileName.toLowerCase().endsWith(".zip"));

    if (!zipFileNames.length) {
      setStatus("선택한 폴더에서 ZIP 파일을 찾지 못했습니다.");
      return;
    }

    downloads = zipFileNames.filter(
      (fileName, index, fileNamesList) => fileNamesList.indexOf(fileName) === index
    );
    persist();
    resetForm();
    refresh();
    setStatus(`${downloads.length}개 ZIP 파일을 읽어 download-data.js를 생성했습니다.`);
  };

  downloadForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const fileName = fileNameField.value.trim();

    if (!fileName.toLowerCase().endsWith(".zip")) {
      setStatus("ZIP 파일명만 추가할 수 있습니다.");
      return;
    }

    if (editingIndex >= 0) {
      downloads[editingIndex] = fileName;
      setStatus("파일명을 수정했습니다.");
    } else if (!downloads.includes(fileName)) {
      downloads.push(fileName);
      setStatus("파일명을 추가했습니다.");
    } else {
      setStatus("이미 등록된 파일명입니다.");
    }

    persist();
    resetForm();
    refresh();
  });

  bulkForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const fileNames = bulkInput.value
      .split(/\r?\n/)
      .map((fileName) => fileName.trim())
      .filter((fileName) => fileName.toLowerCase().endsWith(".zip"));

    downloads = [...downloads, ...fileNames].filter(
      (fileName, index, fileNamesList) => fileNamesList.indexOf(fileName) === index
    );
    bulkForm.reset();
    persist();
    refresh();
    setStatus(`${fileNames.length}개 파일명을 목록에 반영했습니다.`);
  });

  folderButton.addEventListener("click", async () => {
    if ("showDirectoryPicker" in window) {
      try {
        const directoryHandle = await window.showDirectoryPicker();
        const fileNames = [];

        for await (const entry of directoryHandle.values()) {
          if (entry.kind === "file") {
            fileNames.push(entry.name);
          }
        }

        replaceWithLocalFiles(fileNames);
      } catch {
        setStatus("폴더 읽기를 취소했습니다.");
      }
      return;
    }

    folderInput.click();
  });

  folderInput.addEventListener("change", () => {
    replaceWithLocalFiles([...folderInput.files].map((file) => file.name));
    folderInput.value = "";
  });

  resetButton.addEventListener("click", resetForm);

  list.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-download-action]");

    if (!button) {
      return;
    }

    const index = Number(button.dataset.index);
    const action = button.dataset.downloadAction;

    if (action === "edit") {
      editingIndex = index;
      fileNameField.value = downloads[index];
      document.querySelector("#saveDownloadFile").textContent = "파일명 수정";
      setStatus("수정할 파일명을 불러왔습니다.");
      return;
    }

    if (action === "delete") {
      downloads.splice(index, 1);
      persist();
      resetForm();
      refresh();
      setStatus("파일명을 삭제했습니다.");
    }
  });

  copyButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(exportBox.value);
    setStatus("download-data.js 내용을 복사했습니다.");
  });

  saveButton.addEventListener("click", async () => {
    try {
      await downloadTextFile("download-data.js", exportBox.value);
      setStatus("download-data.js 파일을 저장했습니다.");
    } catch {
      setStatus("파일 저장을 취소했습니다.");
    }
  });

  clearButton.addEventListener("click", () => {
    localStorage.removeItem(downloadStorageKey);
    downloads = getDownloadFileNames().map((fileName) => String(fileName).trim()).filter(Boolean);
    resetForm();
    refresh();
    setStatus("임시 저장 데이터를 삭제했습니다.");
  });

  refresh();
}
