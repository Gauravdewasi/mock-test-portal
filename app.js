// ================= SECURITY & 24-HOUR LOCKOUT =================
const ADMIN_PASS = "@Sugnaram77";
const LOCK_DURATION = 24 * 60 * 60 * 1000; // 24 Hours

function checkLockout() {
  const lockUntil = parseInt(localStorage.getItem("mtp_lock_until") || "0", 10);
  const lockScreen = document.getElementById("lockoutScreen");
  if (Date.now() < lockUntil) {
    lockScreen.classList.remove("hidden");
    startLockCountdown(lockUntil);
    return true;
  } else {
    if (lockUntil > 0) {
      localStorage.removeItem("mtp_lock_until");
      localStorage.setItem("mtp_failed_attempts", "0");
    }
    lockScreen.classList.add("hidden");
    return false;
  }
}

function startLockCountdown(lockUntil) {
  const timerEl = document.getElementById("lockoutCountdown");
  const interval = setInterval(() => {
    const diff = lockUntil - Date.now();
    if (diff <= 0) {
      clearInterval(interval);
      location.reload();
      return;
    }
    const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
    const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
    const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
    timerEl.textContent = `${h}:${m}:${s}`;
  }, 1000);
}

function openAdminLogin() {
  if (checkLockout()) return;
  document.getElementById("adminPassInput").value = "";
  document.getElementById("loginErrorMsg").textContent = "";
  document.getElementById("adminLoginModal").classList.remove("hidden");
}

function closeAdminLogin() {
  document.getElementById("adminLoginModal").classList.add("hidden");
}

function verifyAdmin() {
  if (checkLockout()) return;
  const val = document.getElementById("adminPassInput").value;
  if (val === ADMIN_PASS) {
    localStorage.setItem("mtp_failed_attempts", "0");
    closeAdminLogin();
    showScreen("adminPanelScreen");
    loadGhConfig();
  } else {
    let fails = parseInt(localStorage.getItem("mtp_failed_attempts") || "0", 10) + 1;
    localStorage.setItem("mtp_failed_attempts", String(fails));
    if (fails >= 3) {
      const until = Date.now() + LOCK_DURATION;
      localStorage.setItem("mtp_lock_until", String(until));
      closeAdminLogin();
      checkLockout();
    } else {
      document.getElementById("loginErrorMsg").textContent =
        `Galat Password! (${3 - fails} attempt bache hain, uske baad website 24 ghante ke liye block ho jayegi)`;
    }
  }
}

// ================= DATA & SPECIFIC QUESTION SELECTION =================
let catalog = { books: [] };
// Stores custom selected question indices per topic key: "bIdx_tIdx" -> Set of 0-based indices
const customQuestionSelection = {};
let pickerCurrentBIdx = null;
let pickerCurrentTIdx = null;

async function loadCatalog() {
  if (checkLockout()) return;
  injectQuestionPickerModal();
  try {
    const res = await fetch(`./catalog.json?t=${Date.now()}`);
    if (res.ok) {
      catalog = await res.json();
      localStorage.setItem("mtp_catalog_cache", JSON.stringify(catalog));
    }
  } catch (e) {
    const cached = localStorage.getItem("mtp_catalog_cache");
    if (cached) catalog = JSON.parse(cached);
  }
  renderBooks();
}

function getTopicSelectedSet(bIdx, tIdx) {
  const key = `${bIdx}_${tIdx}`;
  const total = catalog.books[bIdx].topics[tIdx].questions.length;
  if (!customQuestionSelection[key]) {
    const allSet = new Set();
    for (let i = 0; i < total; i++) allSet.add(i);
    customQuestionSelection[key] = allSet;
  }
  return customQuestionSelection[key];
}

function renderBooks() {
  const container = document.getElementById("booksContainer");
  if (!catalog.books || catalog.books.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
        Abhi koi test upload nahi hua hai. Upar <strong>Admin Panel</strong> button par click karke apna pehla test upload karein!
      </div>`;
    return;
  }

  container.innerHTML = catalog.books.map((book, bIdx) => `
    <div class="border border-gray-200 rounded-lg overflow-hidden">
      <div onclick="toggleBookTopics(${bIdx})" class="px-4 py-3.5 bg-white hover:bg-red-50 flex justify-between items-center cursor-pointer border-l-4 border-red-600">
        <div class="font-bold text-gray-800">
          📘 ${book.title}
          <span class="ml-2 px-2.5 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded-full">${book.subject}</span>
        </div>
        <span class="text-xs font-semibold text-gray-500">${book.topics.length} Topics ▼</span>
      </div>
      <div id="bookTopics_${bIdx}" class="p-4 bg-gray-50 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        ${book.topics.map((t, tIdx) => {
          const selSet = getTopicSelectedSet(bIdx, tIdx);
          const totalQ = t.questions.length;
          return `
            <div class="p-3 bg-white border border-gray-200 hover:border-red-600 rounded-lg flex flex-col justify-between gap-2 shadow-sm">
              <label class="flex items-center gap-2.5 cursor-pointer text-sm font-bold text-gray-800">
                <input type="checkbox" id="topicCb_${bIdx}_${tIdx}" class="topic-cb w-4 h-4 accent-red-600" data-bidx="${bIdx}" data-tidx="${tIdx}" onchange="renderTimerInputs()" />
                <span>${t.name} <span class="text-xs font-normal text-gray-400">(${totalQ} Qs)</span></span>
              </label>
              <div class="flex justify-between items-center pt-1.5 border-t border-gray-100">
                <span id="qBadge_${bIdx}_${tIdx}" class="text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded">
                  Selected: ${selSet.size} / ${totalQ} Qs
                </span>
                <button type="button" onclick="openQuestionPicker(${bIdx}, ${tIdx})" class="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1 rounded">
                  🎯 Specific Qs
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `).join("");
}

function toggleBookTopics(bIdx) {
  document.getElementById(`bookTopics_${bIdx}`).classList.toggle("hidden");
}

// ================= SPECIFIC QUESTION PICKER MODAL =================
function injectQuestionPickerModal() {
  if (document.getElementById("questionPickerModal")) return;
  const modalDiv = document.createElement("div");
  modalDiv.id = "questionPickerModal";
  modalDiv.className = "hidden fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4";
  modalDiv.innerHTML = `
    <div class="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col p-5 border-t-4 border-red-600 shadow-2xl">
      <div class="flex justify-between items-center pb-3 border-b">
        <div>
          <h2 id="pickerModalTitle" class="text-base font-extrabold text-red-700">Select Specific Questions</h2>
          <p class="text-xs text-gray-500">Scroll karke tick lagayein ya niche box mein range likhein (jaise: 1-14, 18, 19, 25)</p>
        </div>
        <span id="pickerLiveCount" class="bg-red-50 border border-red-600 text-red-700 text-xs font-extrabold px-3 py-1 rounded-full">0 Selected</span>
      </div>

      <!-- Quick Range Input Bar -->
      <div class="my-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
        <label class="block text-xs font-bold text-gray-700 mb-1">Fast Selection by Question Numbers / Range:</label>
        <div class="flex gap-2">
          <input type="text" id="pickerRangeInput" placeholder="e.g. 1-14, 18, 19, 25" class="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-red-600" />
          <button type="button" onclick="applyRangeString()" class="px-4 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-bold">Apply Range</button>
        </div>
        <div class="flex gap-2 mt-2">
          <button type="button" onclick="pickerSelectAll(true)" class="px-2.5 py-1 rounded bg-gray-200 hover:bg-gray-300 text-xs font-bold">Select All</button>
          <button type="button" onclick="pickerSelectAll(false)" class="px-2.5 py-1 rounded bg-gray-200 hover:bg-gray-300 text-xs font-bold">Clear All</button>
        </div>
      </div>

      <!-- Scrollable Checkbox List of All Questions -->
      <div id="pickerQuestionList" class="flex-1 overflow-y-auto border border-gray-200 rounded-lg divide-y max-h-72"></div>

      <!-- Footer -->
      <div class="pt-3 mt-3 border-t flex justify-end gap-2">
        <button type="button" onclick="closeQuestionPicker()" class="px-4 py-2 rounded-md bg-gray-200 text-xs font-bold">Cancel</button>
        <button type="button" onclick="saveQuestionPicker()" class="px-6 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-bold">Done & Save Selection</button>
      </div>
    </div>
  `;
  document.body.appendChild(modalDiv);
}

function openQuestionPicker(bIdx, tIdx) {
  pickerCurrentBIdx = bIdx;
  pickerCurrentTIdx = tIdx;

  // Automatically tick the topic checkbox when user opens specific question picker
  const topicCb = document.getElementById(`topicCb_${bIdx}_${tIdx}`);
  if (topicCb && !topicCb.checked) {
    topicCb.checked = true;
  }

  const book = catalog.books[bIdx];
  const topic = book.topics[tIdx];
  const selSet = getTopicSelectedSet(bIdx, tIdx);

  document.getElementById("pickerModalTitle").textContent = `${book.title} - ${topic.name} (${topic.questions.length} Qs)`;
  document.getElementById("pickerRangeInput").value = setToRangeString(selSet);

  const listEl = document.getElementById("pickerQuestionList");
  listEl.innerHTML = topic.questions.map((q, qIdx) => {
    const qNum = q.id || (qIdx + 1);
    const isChecked = selSet.has(qIdx);
    const shortText = q.question.length > 95 ? q.question.substring(0, 95) + "..." : q.question;
    return `
      <label class="flex items-start gap-3 p-2.5 hover:bg-red-50 cursor-pointer text-xs md:text-sm">
        <input type="checkbox" class="picker-q-cb w-4 h-4 mt-0.5 accent-red-600 shrink-0" data-qidx="${qIdx}" ${isChecked ? "checked" : ""} onchange="updatePickerLiveCounter()" />
        <div>
          <span class="font-extrabold text-red-700 mr-1.5">Q.${qNum}:</span>
          <span class="text-gray-700">${shortText}</span>
        </div>
      </label>
    `;
  }).join("");

  updatePickerLiveCounter();
  document.getElementById("questionPickerModal").classList.remove("hidden");
}

function updatePickerLiveCounter() {
  const allCbs = Array.from(document.querySelectorAll(".picker-q-cb"));
  const checkedCbs = allCbs.filter(cb => cb.checked);
  document.getElementById("pickerLiveCount").textContent = `${checkedCbs.length} / ${allCbs.length} Selected`;

  const tempSet = new Set(checkedCbs.map(cb => parseInt(cb.dataset.qidx, 10)));
  document.getElementById("pickerRangeInput").value = setToRangeString(tempSet);
}

function pickerSelectAll(selectAll) {
  document.querySelectorAll(".picker-q-cb").forEach(cb => {
    cb.checked = selectAll;
  });
  updatePickerLiveCounter();
}

function applyRangeString() {
  const raw = document.getElementById("pickerRangeInput").value.trim();
  const topic = catalog.books[pickerCurrentBIdx].topics[pickerCurrentTIdx];
  const maxQ = topic.questions.length;
  const targetIndices = new Set();

  if (raw) {
    const parts = raw.split(",");
    parts.forEach(part => {
      const p = part.trim();
      if (!p) return;
      if (p.includes("-")) {
        const [startStr, endStr] = p.split("-");
        const start = parseInt(startStr.trim(), 10);
        const end = parseInt(endStr.trim(), 10);
        if (!isNaN(start) && !isNaN(end)) {
          const s = Math.max(1, Math.min(start, end));
          const e = Math.min(maxQ, Math.max(start, end));
          for (let num = s; num <= e; num++) targetIndices.add(num - 1);
        }
      } else {
        const num = parseInt(p, 10);
        if (!isNaN(num) && num >= 1 && num <= maxQ) {
          targetIndices.add(num - 1);
        }
      }
    });
  }

  document.querySelectorAll(".picker-q-cb").forEach(cb => {
    const idx = parseInt(cb.dataset.qidx, 10);
    cb.checked = targetIndices.has(idx);
  });
  updatePickerLiveCounter();
}

function setToRangeString(indexSet) {
  const nums = Array.from(indexSet).map(i => i + 1).sort((a, b) => a - b);
  if (nums.length === 0) return "";
  const ranges = [];
  let start = nums[0], prev = nums[0];

  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === prev + 1) {
      prev = nums[i];
    } else {
      ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = prev = nums[i];
    }
  }
  ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
  return ranges.join(", ");
}

function closeQuestionPicker() {
  document.getElementById("questionPickerModal").classList.add("hidden");
}

function saveQuestionPicker() {
  const checkedCbs = Array.from(document.querySelectorAll(".picker-q-cb:checked"));
  if (checkedCbs.length === 0) {
    alert("Kam se kam 1 question zaroor select karein!");
    return;
  }
  const key = `${pickerCurrentBIdx}_${pickerCurrentTIdx}`;
  customQuestionSelection[key] = new Set(checkedCbs.map(cb => parseInt(cb.dataset.qidx, 10)));

  const totalQ = catalog.books[pickerCurrentBIdx].topics[pickerCurrentTIdx].questions.length;
  const badge = document.getElementById(`qBadge_${pickerCurrentBIdx}_${pickerCurrentTIdx}`);
  if (badge) {
    badge.textContent = `Selected: ${checkedCbs.length} / ${totalQ} Qs`;
  }

  closeQuestionPicker();
  renderTimerInputs();
}

// ================= MERGED BOOK SECTIONS & TIMER =================
function getSelectedBookSections() {
  const checked = Array.from(document.querySelectorAll(".topic-cb:checked"));
  const bookMap = new Map();

  checked.forEach(cb => {
    const bIdx = parseInt(cb.dataset.bidx, 10);
    const tIdx = parseInt(cb.dataset.tidx, 10);
    const book = catalog.books[bIdx];
    const topic = book.topics[tIdx];
    const selSet = getTopicSelectedSet(bIdx, tIdx);

    if (!bookMap.has(bIdx)) {
      bookMap.set(bIdx, {
        bookIndex: bIdx,
        sectionName: `${book.title} (${book.subject})`,
        subject: book.subject,
        bookTitle: book.title,
        topicsIncluded: [],
        questions: []
      });
    }
    const sec = bookMap.get(bIdx);
    sec.topicsIncluded.push(topic.name);

    topic.questions.forEach((q, qIdx) => {
      if (selSet.has(qIdx)) {
        sec.questions.push({
          ...q,
          bookQNum: q.id || (qIdx + 1),
          topicName: topic.name,
          selectedOption: null,
          status: "not_visited"
        });
      }
    });
  });

  return Array.from(bookMap.values()).filter(sec => sec.questions.length > 0);
}

function renderTimerInputs() {
  const useTimer = document.getElementById("customTimerToggle").checked;
  const box = document.getElementById("sectionalTimerInputs");
  if (!useTimer) {
    box.classList.add("hidden");
    return;
  }
  const sections = getSelectedBookSections();
  if (sections.length === 0) {
    box.innerHTML = `<span class="text-xs text-red-600 font-semibold">Pehle upar se koi topic tick karein.</span>`;
    box.classList.remove("hidden");
    return;
  }
  box.innerHTML = sections.map((sec, idx) => `
    <div class="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded-md text-xs font-bold text-red-800">
      <span>${sec.sectionName} (${sec.questions.length} Qs):</span>
      <input type="number" id="secTime_${idx}" value="15" min="1" max="180" class="w-14 px-1.5 py-0.5 border border-red-500 rounded text-center bg-white" /> mins
    </div>
  `).join("");
  box.classList.remove("hidden");
}

function openSymbolsPopup() {
  const sections = getSelectedBookSections();
  if (sections.length === 0) {
    alert("Test shuru karne ke liye kam se kam ek topic par tick lagayein!");
    return;
  }
  document.getElementById("symbolsModal").classList.remove("hidden");
}

function closeSymbolsPopup() {
  document.getElementById("symbolsModal").classList.add("hidden");
}

// ================= CBT EXAM ENGINE =================
let activeSections = [];
let currentSecIdx = 0;
let currentQIdx = 0;
let hasCustomTimer = false;
let timerInterval = null;

function beginMockTest() {
  closeSymbolsPopup();
  activeSections = getSelectedBookSections();
  hasCustomTimer = document.getElementById("customTimerToggle").checked;

  activeSections.forEach((sec, idx) => {
    const inputEl = document.getElementById(`secTime_${idx}`);
    const mins = (hasCustomTimer && inputEl) ? Math.max(1, parseInt(inputEl.value || "15", 10)) : 0;
    sec.remainingSeconds = mins * 60;
    sec.elapsedSeconds = 0;
  });

  currentSecIdx = 0;
  currentQIdx = 0;
  showScreen("examScreen");
  visitQuestion(0, 0);
  startExamTimer();
}

function startExamTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const sec = activeSections[currentSecIdx];
    if (!sec) return;
    sec.elapsedSeconds++;

    if (hasCustomTimer) {
      sec.remainingSeconds--;
      if (sec.remainingSeconds <= 0) {
        if (currentSecIdx < activeSections.length - 1) {
          alert(`${sec.sectionName} ka samay samapt! Agle section par ja rahe hain.`);
          switchSection(currentSecIdx + 1);
        } else {
          clearInterval(timerInterval);
          alert("Time up! Test automatically submit ho raha hai.");
          finalizeResult();
        }
        return;
      }
      document.getElementById("timerDisplay").textContent = `Time Left: ${formatTime(sec.remainingSeconds)}`;
    } else {
      document.getElementById("timerDisplay").textContent = `Time: ${formatTime(sec.elapsedSeconds)}`;
    }
  }, 1000);
}

function formatTime(totalSec) {
  const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function switchSection(sIdx) {
  visitQuestion(sIdx, 0);
}

function visitQuestion(sIdx, qIdx) {
  currentSecIdx = sIdx;
  currentQIdx = qIdx;
  const q = activeSections[sIdx].questions[qIdx];
  if (q.status === "not_visited") q.status = "not_answered";

  renderSectionTabs();
  renderQuestionArea();
  renderPalette();
}

function renderSectionTabs() {
  document.getElementById("sectionTabs").innerHTML = activeSections.map((sec, idx) => `
    <button onclick="switchSection(${idx})" class="px-3.5 py-1.5 rounded-md text-xs font-bold border ${
      idx === currentSecIdx ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-700 border-gray-300"
    }">
      ${sec.sectionName} (${sec.questions.length})
    </button>
  `).join("");
}

function renderQuestionArea() {
  const sec = activeSections[currentSecIdx];
  const q = sec.questions[currentQIdx];

  document.getElementById("qNumberLabel").textContent = `Question ${currentQIdx + 1} of ${sec.questions.length} (Book Q.${q.bookQNum})`;
  document.getElementById("qTopicBadge").textContent = `Topic: ${q.topicName}`;
  document.getElementById("qTextDisplay").textContent = q.question;

  const isRev = (q.status === "review" || q.status === "ans_review");
  document.getElementById("reviewBtn").textContent = isRev ? "Unmark Review" : "Mark for Review";

  document.getElementById("optionsContainer").innerHTML = q.options.map((opt, oIdx) => {
    const isSel = q.selectedOption === oIdx;
    return `
      <div onclick="selectOption(${oIdx})" class="flex items-center gap-3 p-3.5 rounded-lg border cursor-pointer transition ${
        isSel ? "bg-red-50 border-red-600 font-semibold" : "bg-white border-gray-200 hover:border-red-400"
      }">
        <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
          isSel ? "border-red-600" : "border-gray-400"
        }">
          ${isSel ? '<div class="w-2.5 h-2.5 rounded-full bg-red-600"></div>' : ""}
        </div>
        <div class="text-sm md:text-base">${opt}</div>
      </div>
    `;
  }).join("");
}

function selectOption(oIdx) {
  const q = activeSections[currentSecIdx].questions[currentQIdx];
  if (q.selectedOption === oIdx) {
    q.selectedOption = null;
    q.status = (q.status === "ans_review") ? "review" : "not_answered";
  } else {
    q.selectedOption = oIdx;
    q.status = (q.status === "review" || q.status === "ans_review") ? "ans_review" : "answered";
  }
  renderQuestionArea();
  renderPalette();
}

function toggleReview() {
  const q = activeSections[currentSecIdx].questions[currentQIdx];
  if (q.status === "review") q.status = "not_answered";
  else if (q.status === "ans_review") q.status = "answered";
  else q.status = (q.selectedOption !== null) ? "ans_review" : "review";

  renderQuestionArea();
  renderPalette();
}

function saveAndNext() {
  const sec = activeSections[currentSecIdx];
  const q = sec.questions[currentQIdx];
  if (q.selectedOption !== null && q.status !== "ans_review") q.status = "answered";
  else if (q.selectedOption === null && q.status !== "review") q.status = "not_answered";

  if (currentQIdx < sec.questions.length - 1) {
    visitQuestion(currentSecIdx, currentQIdx + 1);
  } else if (currentSecIdx < activeSections.length - 1) {
    switchSection(currentSecIdx + 1);
  } else {
    renderPalette();
  }
}

function prevQuestion() {
  if (currentQIdx > 0) visitQuestion(currentSecIdx, currentQIdx - 1);
}

function renderPalette() {
  const sec = activeSections[currentSecIdx];
  let ans = 0, notAns = 0, notVis = 0, rev = 0;

  document.getElementById("paletteGrid").innerHTML = sec.questions.map((q, idx) => {
    let cls = "st-not-visited";
    if (q.status === "answered") { cls = "st-answered"; ans++; }
    else if (q.status === "not_answered") { cls = "st-not-answered"; notAns++; }
    else if (q.status === "review") { cls = "st-review"; rev++; }
    else if (q.status === "ans_review") { cls = "st-ans-review"; ans++; rev++; }
    else { notVis++; }

    return `<button onclick="visitQuestion(${currentSecIdx}, ${idx})" title="Book Q.${q.bookQNum}" class="q-circle ${cls} ${idx === currentQIdx ? "current" : ""}">${idx + 1}</button>`;
  }).join("");

  document.getElementById("cntAnswered").textContent = ans;
  document.getElementById("cntNotAnswered").textContent = notAns;
  document.getElementById("cntNotVisited").textContent = notVis;
  document.getElementById("cntReview").textContent = rev;
}

// ================= SUBMIT SUMMARY & FINAL RESULT =================
function openSubmitModal() {
  let rowsHtml = "";
  let gTotal = 0, gAns = 0, gNotAns = 0, gRev = 0, gNotVis = 0;

  activeSections.forEach(sec => {
    const topicMap = {};
    sec.questions.forEach(q => {
      if (!topicMap[q.topicName]) topicMap[q.topicName] = { total: 0, ans: 0, notAns: 0, rev: 0, notVis: 0 };
      const st = topicMap[q.topicName];
      st.total++; gTotal++;
      if (q.status === "answered" || q.status === "ans_review") { st.ans++; gAns++; }
      else if (q.status === "not_answered" || q.status === "review") { st.notAns++; gNotAns++; }
      else { st.notVis++; gNotVis++; }
      if (q.status === "review" || q.status === "ans_review") { st.rev++; gRev++; }
    });

    Object.keys(topicMap).forEach(tName => {
      const st = topicMap[tName];
      rowsHtml += `
        <tr class="border-b">
          <td class="border p-2.5"><strong>${sec.bookTitle}</strong> - ${tName}</td>
          <td class="border p-2.5">${st.total}</td>
          <td class="border p-2.5 text-green-600 font-bold">${st.ans}</td>
          <td class="border p-2.5 text-red-600 font-bold">${st.notAns}</td>
          <td class="border p-2.5">${st.rev}</td>
          <td class="border p-2.5">${st.notVis}</td>
        </tr>`;
    });
  });

  rowsHtml += `
    <tr class="bg-red-50 font-extrabold text-red-900">
      <td class="border p-2.5">TOTAL</td>
      <td class="border p-2.5">${gTotal}</td>
      <td class="border p-2.5">${gAns}</td>
      <td class="border p-2.5">${gNotAns}</td>
      <td class="border p-2.5">${gRev}</td>
      <td class="border p-2.5">${gNotVis}</td>
    </tr>`;

  document.getElementById("submitSummaryBody").innerHTML = rowsHtml;
  document.getElementById("submitModal").classList.remove("hidden");
}

function closeSubmitModal() {
  document.getElementById("submitModal").classList.add("hidden");
}

function finalizeResult() {
  closeSubmitModal();
  if (timerInterval) clearInterval(timerInterval);

  let totalQ = 0, attempted = 0, correct = 0, wrong = 0, unattempted = 0;
  const subjectBoxes = [];

  activeSections.forEach(sec => {
    let sTotal = sec.questions.length, sAtt = 0, sCorr = 0, sWrong = 0, sUnatt = 0;
    sec.questions.forEach(q => {
      totalQ++;
      if (q.selectedOption !== null) {
        attempted++; sAtt++;
        if (q.selectedOption === q.correctAnswer) { correct++; sCorr++; }
        else { wrong++; sWrong++; }
      } else {
        unattempted++; sUnatt++;
      }
    });

    const sMinus = sWrong * 0.25;
    const sNet = (sCorr - sMinus).toFixed(2);
    const sAcc = sAtt > 0 ? ((sCorr / sAtt) * 100).toFixed(1) : "0.0";

    subjectBoxes.push(`
      <div class="bg-white border border-gray-200 border-l-4 border-l-red-600 rounded-xl p-4 shadow-sm">
        <h4 class="font-extrabold text-red-700 text-base">${sec.subject} (${sec.bookTitle})</h4>
        <p class="text-xs text-gray-500 font-semibold mb-3">Topics: ${sec.topicsIncluded.join(", ")} | Time: ${formatTime(sec.elapsedSeconds)}</p>
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="bg-red-50 border border-red-200 rounded p-2">
            <span class="block text-[11px] text-gray-500 font-bold">Net Score</span>
            <strong class="text-sm text-red-700">${sNet} / ${sTotal}</strong>
          </div>
          <div class="bg-gray-50 border rounded p-2">
            <span class="block text-[11px] text-gray-500 font-bold">Correct</span>
            <strong class="text-sm text-green-600">${sCorr}</strong>
          </div>
          <div class="bg-gray-50 border rounded p-2">
            <span class="block text-[11px] text-gray-500 font-bold">Wrong (-1/4)</span>
            <strong class="text-sm text-red-600">${sWrong} (-${sMinus.toFixed(2)})</strong>
          </div>
          <div class="bg-gray-50 border rounded p-2">
            <span class="block text-[11px] text-gray-500 font-bold">Attempted</span>
            <strong class="text-sm">${sAtt}/${sTotal}</strong>
          </div>
          <div class="bg-gray-50 border rounded p-2">
            <span class="block text-[11px] text-gray-500 font-bold">Left</span>
            <strong class="text-sm">${sUnatt}</strong>
          </div>
          <div class="bg-gray-50 border rounded p-2">
            <span class="block text-[11px] text-gray-500 font-bold">Accuracy</span>
            <strong class="text-sm">${sAcc}%</strong>
          </div>
        </div>
      </div>
    `);
  });

  const minusMarks = wrong * 0.25;
  const finalScore = (correct - minusMarks).toFixed(2);
  const accuracy = attempted > 0 ? ((correct / attempted) * 100).toFixed(1) : "0.0";

  const makeBox = (label, val, extraCls = "") => `
    <div class="bg-white border border-gray-200 border-t-4 border-t-red-600 rounded-xl p-4 text-center shadow-sm ${extraCls}">
      <div class="text-[11px] uppercase font-bold text-gray-500 mb-1">${label}</div>
      <div class="text-xl font-extrabold text-gray-800">${val}</div>
    </div>`;

  document.getElementById("overallResultBoxes").innerHTML = [
    makeBox("Final Net Score", `<span class="text-red-700">${finalScore} / ${totalQ}</span>`, "bg-red-50"),
    makeBox("Total Questions", totalQ),
    makeBox("Attempted", attempted),
    makeBox("Correct (+1)", `<span class="text-green-600">${correct}</span>`),
    makeBox("Wrong (-0.25)", `<span class="text-red-600">${wrong} (-${minusMarks.toFixed(2)})</span>`),
    makeBox("Not Attempted", unattempted),
    makeBox("Accuracy", `${accuracy}%`)
  ].join("");

  document.getElementById("subjectResultBoxes").innerHTML = subjectBoxes.join("");

  showScreen("resultScreen");
  renderSolutions("wrong");
}

function renderSolutions(filter) {
  const activeCls = "px-3 py-1.5 rounded text-xs font-bold bg-red-600 text-white";
  const inactiveCls = "px-3 py-1.5 rounded text-xs font-bold border border-red-600 text-red-600";
  document.getElementById("fltWrong").className = filter === "wrong" ? activeCls : inactiveCls;
  document.getElementById("fltUnattempted").className = filter === "unattempted" ? activeCls : inactiveCls;
  document.getElementById("fltAll").className = filter === "all" ? activeCls : inactiveCls;

  const items = [];
  let qNum = 0;

  activeSections.forEach(sec => {
    sec.questions.forEach(q => {
      qNum++;
      const isWrong = q.selectedOption !== null && q.selectedOption !== q.correctAnswer;
      const isUnatt = q.selectedOption === null;

      if (filter === "wrong" && !isWrong) return;
      if (filter === "unattempted" && !isUnatt) return;

      const userAns = q.selectedOption !== null ? q.options[q.selectedOption] : "Not Attempted";
      const corrAns = q.options[q.correctAnswer];

      items.push(`
        <div class="border border-gray-200 rounded-lg p-4 bg-white">
          <div class="flex justify-between items-center text-xs font-bold mb-2">
            <span class="text-red-700">Test Q.${qNum} [Book Q.${q.bookQNum}] (${sec.subject} - ${q.topicName})</span>
            <span class="${isWrong ? "text-red-600" : isUnatt ? "text-gray-500" : "text-green-600"}">
              ${isWrong ? "❌ Wrong (-0.25)" : isUnatt ? "⚪ Unattempted" : "✅ Correct (+1.00)"}
            </span>
          </div>
          <div class="font-semibold text-sm md:text-base mb-2.5 whitespace-pre-line">${q.question}</div>
          <div class="text-xs md:text-sm mb-3">
            <strong>Your Answer:</strong> <span class="${isWrong ? "text-red-600 font-bold" : ""}">${userAns}</span> |
            <strong class="text-green-700">Correct Answer: ${corrAns}</strong>
          </div>
          <div class="bg-red-50 border-l-4 border-red-600 p-3 rounded text-sm leading-relaxed whitespace-pre-line">
            <strong>💡 Hinglish Solution:</strong> ${q.solutionHinglish || "Solution available in answer key."}
          </div>
        </div>
      `);
    });
  });

  document.getElementById("solutionsList").innerHTML =
    items.length > 0 ? items.join("") : `<div class="p-4 text-sm text-gray-500">Is filter mein koi question nahi hai.</div>`;
}

// ================= GITHUB AUTO-UPLOAD ADMIN =================
function loadGhConfig() {
  const host = window.location.hostname;
  const defaultOwner = host.endsWith(".github.io") ? host.split(".")[0] : "";
  document.getElementById("ghOwner").value = localStorage.getItem("mtp_gh_owner") || defaultOwner;
  document.getElementById("ghRepo").value = localStorage.getItem("mtp_gh_repo") || "mock-test-portal";
  document.getElementById("ghToken").value = localStorage.getItem("mtp_gh_token") || "";
}

function saveGhConfig() {
  localStorage.setItem("mtp_gh_owner", document.getElementById("ghOwner").value.trim());
  localStorage.setItem("mtp_gh_repo", document.getElementById("ghRepo").value.trim());
  localStorage.setItem("mtp_gh_token", document.getElementById("ghToken").value.trim());
  alert("GitHub Connection Details Saved!");
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => { document.getElementById("jsonPasteInput").value = ev.target.result; };
  reader.readAsText(file);
}

async function uploadTestToGitHub() {
  const statusEl = document.getElementById("uploadStatus");
  const rawJson = document.getElementById("jsonPasteInput").value.trim();
  if (!rawJson) {
    statusEl.className = "mt-3 text-sm font-bold text-red-600";
    statusEl.textContent = "Pehle JSON file chunein ya code paste karein!";
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawJson);
  } catch (err) {
    statusEl.className = "mt-3 text-sm font-bold text-red-600";
    statusEl.textContent = "Invalid JSON format! Check brackets/quotes.";
    return;
  }

  mergeTestIntoCatalog(payload);
  localStorage.setItem("mtp_catalog_cache", JSON.stringify(catalog));
  renderBooks();

  const owner = document.getElementById("ghOwner").value.trim();
  const repo = document.getElementById("ghRepo").value.trim();
  const token = document.getElementById("ghToken").value.trim();

  if (!owner || !repo || !token) {
    statusEl.className = "mt-3 text-sm font-bold text-green-600";
    statusEl.textContent = "Browser mein add ho gaya! (GitHub par permanent save karne ke liye upar Token save karein).";
    return;
  }

  statusEl.className = "mt-3 text-sm font-bold text-gray-700";
  statusEl.textContent = "Uploading to GitHub repository...";

  try {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/catalog.json`;
    const getRes = await fetch(apiUrl, {
      headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" }
    });

    let sha;
    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
    }

    const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(catalog, null, 2))));
    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `Add test: ${payload.book || "Book"} - ${payload.topic || "Topic"}`,
        content: contentBase64,
        sha: sha
      })
    });

    if (putRes.ok) {
      statusEl.className = "mt-3 text-sm font-bold text-green-600";
      statusEl.textContent = "✅ Successfully uploaded to GitHub! Website permanent update ho gayi.";
      document.getElementById("jsonPasteInput").value = "";
    } else {
      const errData = await putRes.json();
      statusEl.className = "mt-3 text-sm font-bold text-red-600";
      statusEl.textContent = `GitHub Error: ${errData.message}`;
    }
  } catch (err) {
    statusEl.className = "mt-3 text-sm font-bold text-red-600";
    statusEl.textContent = `Network Error: ${err.message}`;
  }
}

function mergeTestIntoCatalog(data) {
  if (!catalog.books) catalog.books = [];
  const bookTitle = data.book || "General Mock Book";
  const subject = data.subject || "General";
  const topicName = data.topic || "Practice Set";
  const questions = data.questions || [];

  let book = catalog.books.find(b => b.title.toLowerCase() === bookTitle.toLowerCase());
  if (!book) {
    book = { id: "b_" + Date.now(), title: bookTitle, subject: subject, topics: [] };
    catalog.books.push(book);
  }

  let topic = book.topics.find(t => t.name.toLowerCase() === topicName.toLowerCase());
  if (!topic) {
    topic = { id: "t_" + Date.now(), name: topicName, questions: questions };
    book.topics.push(topic);
  } else {
    topic.questions = questions;
  }
}

// ================= NAVIGATION =================
function showScreen(screenId) {
  ["homeScreen", "examScreen", "resultScreen", "adminPanelScreen"].forEach(id => {
    document.getElementById(id).classList.add("hidden");
  });
  document.getElementById(screenId).classList.remove("hidden");
}

function goHome() {
  if (timerInterval) clearInterval(timerInterval);
  showScreen("homeScreen");
  renderBooks();
}

window.onload = loadCatalog;
