import React, { useState, useEffect, useRef } from "react";

// ============================================================
// VINO·DIARY — 와인·위스키 취향 다이어리
// v0.2  (GitHub Pages + Google Sheets via Apps Script)
//
// 데이터/AI는 모두 Apps Script Web App 경유.
// 앱 첫 실행 시 API URL을 입력받아 localStorage에 저장(설정만 로컬).
// 시음 기록 자체는 Google Sheet에 저장 → 기기 간 동기화됨.
// ============================================================

const API_KEY_LS = "vinodiary:apiUrl";
const NAME_LS = "vinodiary:userName";
const APP_VERSION = "v0.27";

// 한국시간(KST, UTC+9) 기준 "YYYY-MM-DD HH:mm"
function kstNow() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const iso = d.toISOString(); // ...UTC지만 +9 보정됨
  return iso.slice(0, 10) + " " + iso.slice(11, 16);
}
// KST 날짜만 "YYYY-MM-DD"
function kstDate() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// ---------- API 레이어 ----------
function getApiUrl() {
  return localStorage.getItem(API_KEY_LS) || "";
}
async function api(payload) {
  const url = getApiUrl();
  if (!url) throw new Error("API URL이 설정되지 않았습니다.");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // CORS 프리플라이트 회피
    body: JSON.stringify(payload),
  });
  return res.json();
}
async function apiList() {
  const url = getApiUrl();
  const res = await fetch(url + "?action=list");
  return res.json();
}

// ---------- UI 토큰 ----------
const C = {
  bg: "#13110E", panel: "#1C1916", panel2: "#24201B", line: "#3A332A",
  gold: "#C9A24B", goldDim: "#8C7637", text: "#EAE3D6", sub: "#9A9081",
  wine: "#7C2A3A", whisky: "#A6612A",
};

// 축 라벨 한글화
const AXIS_LABELS = {
  mineral: "미네랄", acidity: "산도", salinity: "짠맛", body: "바디",
  texture: "질감", fruit: "과실", complexity: "복합미",
  peat: "피트", sherry: "셰리", spice: "스파이스", oiliness: "오일리", abv: "도수감",
};

// 점수 입력: 슬라이더 + 직접 입력 + 빠른 버튼. 0~100 임의 점수 가능.
function ScoreInput({ onSubmit, accent }) {
  const C2 = { gold: "#C9A24B", goldDim: "#7C6A3A", line: "#3A332A", panel2: "#1F1B15",
    text: "#EAE3D6", sub: "#9A9081" };
  const [val, setVal] = React.useState(85);
  const col = accent || C2.gold;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <input type="range" min="0" max="100" value={val}
          onChange={(e) => setVal(Number(e.target.value))}
          style={{ flex: 1, accentColor: col }} />
        <input type="number" min="0" max="100" value={val}
          onChange={(e) => {
            let v = Number(e.target.value);
            if (isNaN(v)) v = 0; v = Math.max(0, Math.min(100, v));
            setVal(v);
          }}
          style={{ width: 54, background: C2.panel2, border: `1px solid ${C2.line}`,
            borderRadius: 8, color: col, padding: "6px 8px", fontSize: 15, fontWeight: 700,
            textAlign: "center" }} />
        <button onClick={() => onSubmit(val)}
          style={{ padding: "8px 14px", background: col, color: "#1B160C", border: "none",
            borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>입력</button>
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {[60, 70, 75, 80, 85, 90, 95].map((s) => (
          <button key={s} onClick={() => setVal(s)}
            style={{ flex: "1 0 12%", padding: "5px 0", fontSize: 12, background: C2.panel2,
              color: val === s ? col : C2.sub, border: `1px solid ${val === s ? col : C2.line}`,
              borderRadius: 6, cursor: "pointer" }}>{s}</button>
        ))}
      </div>
    </div>
  );
}

function AxisBars({ axes }) {
  if (!axes || typeof axes !== "object") return null;
  const keys = Object.keys(axes);
  if (!keys.length) return null;
  return (
    <div style={{ marginTop: 4 }}>
      {keys.map((k) => {
        const v = Math.max(0, Math.min(5, Number(axes[k]) || 0));
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <span style={{ width: 58, fontSize: 11, color: "#9A9081", flexShrink: 0, textAlign: "right" }}>
              {AXIS_LABELS[k] || k}
            </span>
            <div style={{ flex: 1, height: 6, background: "#24201B", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${(v / 5) * 100}%`, height: "100%", background: "#C9A24B",
                borderRadius: 3 }} />
            </div>
            <span style={{ width: 14, fontSize: 11, color: "#C9A24B", textAlign: "right" }}>{v}</span>
          </div>
        );
      })}
    </div>
  );
}

function ScoreRing({ value, size = 64 }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value || 0)) / 100;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.line} strokeWidth="4" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.gold} strokeWidth="4"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle"
        fill={C.text} fontSize={size * 0.28} fontWeight="600" fontFamily="Georgia, serif">
        {value ?? "–"}
      </text>
    </svg>
  );
}

export default function App() {
  const [ready, setReady] = useState(!!getApiUrl());
  const [urlInput, setUrlInput] = useState(getApiUrl());
  const [tab, setTab] = useState("add");
  const [entries, setEntries] = useState([]);
  const [text, setText] = useState("");
  const [imageData, setImageData] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [recs, setRecs] = useState(null);
  const [recLoading, setRecLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [kindFilter, setKindFilter] = useState("all"); // all | wine | whisky | wishlist
  const [expandedId, setExpandedId] = useState(null);
  const [recDetail, setRecDetail] = useState({});
  const [recDetailLoading, setRecDetailLoading] = useState(null);
  const [recFor, setRecFor] = useState("me"); // 추천 기준: me | common | 친구이름
  const [raters, setRaters] = useState([]);    // 등록된 친구 목록
  const [ratingFor, setRatingFor] = useState({}); // {entryId: "친구이름"} 평가자 선택
  const [axesLoading, setAxesLoading] = useState(null);
  const [pairingLoading, setPairingLoading] = useState(null);
  const [foodText, setFoodText] = useState("");
  const [foodResult, setFoodResult] = useState(null);
  const [foodLoading, setFoodLoading] = useState(false);
  const [profile, setProfile] = useState(null);     // 취향 분석 결과
  const [profileLoading, setProfileLoading] = useState(false);
  const [toast, setToast] = useState(null); // {msg, kind: "loading"|"done"|"error"}
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent"); // recent | score
  const [analyzeMode, setAnalyzeMode] = useState("single"); // single | menu
  const [analyzeFor, setAnalyzeFor] = useState("me"); // 분석 기준 평가자: me | 친구이름
  const [userName, setUserName] = useState(() => {
    try { return localStorage.getItem(NAME_LS) || ""; } catch (e) { return ""; }
  });
  const [companions, setCompanions] = useState(""); // 함께한 사람
  const [note, setNote] = useState(""); // 메모
  const [menuResult, setMenuResult] = useState(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [candidates, setCandidates] = useState(null); // 단일 분석 후보 목록
  const [candLoading, setCandLoading] = useState(false);
  // 월드컵 상태
  const [wcCategory, setWcCategory] = useState(null); // champagne|white|red|whisky
  const [wcSource, setWcSource] = useState("mix");     // cellar|outside|mix
  const [wcSize, setWcSize] = useState(8);             // 4|8|16
  const [wcRound, setWcRound] = useState(null);        // 현재 라운드 후보 배열
  const [wcPair, setWcPair] = useState(0);             // 현재 맞대결 인덱스
  const [wcWinners, setWcWinners] = useState([]);      // 이번 라운드 승자들
  const [wcChampion, setWcChampion] = useState(null);  // 우승
  const [wcRunnerUp, setWcRunnerUp] = useState(null);  // 준우승
  const [wcLoading, setWcLoading] = useState(false);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    if (ready) refresh();
  }, [ready]);

  // 토스트: 저장 진행/완료/실패를 화면 하단에 잠깐 표시
  function showToast(msg, kind) {
    setToast({ msg, kind: kind || "done" });
    if (kind !== "loading") setTimeout(() => setToast(null), 1800);
  }
  function saveName(name) {
    setUserName(name);
    try { localStorage.setItem(NAME_LS, name); } catch (e) {}
  }
  // 저장 계열 API를 토스트와 함께 호출
  async function savingApi(payload, doneMsg) {
    showToast("저장 중…", "loading");
    try {
      const r = await api(payload);
      if (r && r.error) throw new Error(r.error);
      showToast(doneMsg || "저장됨", "done");
      return r;
    } catch (e) {
      showToast("저장 실패 — 다시 시도해 주세요", "error");
      throw e;
    }
  }

  async function refresh() {
    setSyncing(true);
    try {
      const r = await apiList();
      const list = r.entries || [];
      setEntries(list);
      // 친구 목록 수집 (scores의 모든 키)
      const set = {};
      list.forEach((e) => { if (e.scores) Object.keys(e.scores).forEach((n) => (set[n] = true)); });
      setRaters(Object.keys(set));
    } catch (e) {
      setError("기록을 불러오지 못했어요. API URL을 확인하세요.");
    } finally {
      setSyncing(false);
    }
  }

  function saveUrl() {
    if (!urlInput.startsWith("https://")) {
      setError("올바른 Web App URL을 입력하세요.");
      return;
    }
    localStorage.setItem(API_KEY_LS, urlInput.trim());
    setError(null);
    setReady(true);
  }

  function onPickImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // 가로 최대 1600px로 축소, JPEG 0.8로 재인코딩(용량↓ → 전송·분석 안정)
        const maxW = 1600;
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setImageData(dataUrl.split(",")[1]);
        setImagePreview(dataUrl);
      };
      img.onerror = () => {
        // 디코딩 실패 시 원본 사용(폴백)
        setImageData(reader.result.split(",")[1]);
        setImagePreview(reader.result);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  async function onAnalyze() {
    if (!text && !imageData) {
      setError("사진을 올리거나 술에 대해 설명해 주세요.");
      return;
    }
    setError(null);
    setCandLoading(true);
    setResult(null);
    setCandidates(null);
    try {
      const r = await api({ action: "analyzeCandidates", text, imageData });
      if (r.error) throw new Error(r.error);
      const list = (r.candidates || []).filter((c) => c && c.name);
      if (list.length === 0) {
        setError("후보를 찾지 못했어요. 이름을 더 구체적으로 적어 보세요.");
      } else if (list.length === 1) {
        // 후보가 하나면 바로 상세 분석
        await analyzeOne(list[0].name, list[0].kind);
      } else {
        setCandidates(list);
      }
    } catch (e) {
      setError("분석에 실패했어요. 다시 시도해 주세요.");
      console.error(e);
    } finally {
      setCandLoading(false);
    }
  }

  // 후보 하나를 골라 상세 분석
  async function analyzeOne(name, kind) {
    setError(null);
    setAnalyzing(true);
    setResult(null);
    setCandidates(null);
    try {
      const r = await api({ action: "analyze", text: name + (kind ? " (" + kind + ")" : ""), forWhom: analyzeFor });
      if (r.error) throw new Error(r.error);
      setResult(r);
    } catch (e) {
      setError("분석에 실패했어요. 다시 시도해 주세요.");
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  }

  async function runMenuAnalyze() {
    if (!text && !imageData) {
      setError("메뉴판·매대 사진을 올리거나 목록을 적어 주세요.");
      return;
    }
    setError(null);
    setMenuLoading(true);
    setMenuResult(null);
    try {
      const r = await api({ action: "analyzeMenu", text, imageData });
      if (r.error) throw new Error(r.error);
      if (!r.items || r.items.length === 0) {
        setError("사진에서 술을 읽지 못했어요. 더 선명하게 찍거나 리스트를 텍스트로 붙여넣어 보세요.");
        return;
      }
      setMenuResult(r);
    } catch (e) {
      setError("메뉴판 분석 실패: " + (e.message || "다시 시도해 주세요") + (imageData ? " (사진이 크면 일부만 보이게 잘라 다시 시도)" : ""));
      console.error(e);
    } finally {
      setMenuLoading(false);
    }
  }

  // 메뉴판 결과의 한 항목을 위시리스트/셀러로 저장
  async function saveMenuItem(item, status) {
    const entry = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      date: kstNow(),
      name: item.name, kind: item.kind,
      resembles: item.why || "",
      predictedScore: item.predictedScore ?? null,
      reason: item.why || "",
      myScore: null, image: "",
      status: status || "wishlist",
      axes: null, subtype: item.subtype || "",
    };
    await savingApi({ action: "save", entry }, status === "tasted" ? "셀러에 저장됨" : "위시리스트에 담음");
    refresh();
  }

  async function saveResult(score, status) {
    const isMe = analyzeFor === "me" || analyzeFor === "나";
    // 사진이 있으면 Drive 업로드 후 URL 확보
    let imageUrl = "";
    if (imageData) {
      showToast("사진 올리는 중…", "loading");
      try {
        const up = await api({ action: "uploadPhoto", imageData });
        if (up && up.ok && up.url) imageUrl = up.url;
      } catch (e) { /* 사진 실패해도 기록은 저장 */ }
    }
    const entry = {
      id: Date.now(),
      date: kstNow(),
      name: result.name,
      kind: result.kind,
      resembles: result.resembles,
      predictedScore: result.predictedScore,
      reason: result.reason,
      myScore: isMe ? (score ?? null) : null,
      scores: (!isMe && score != null) ? { [analyzeFor]: score } : {},
      image: imageUrl,
      status: status || "tasted",
      axes: result.axes || null,
      subtype: result.subtype || "",
      companions: companions.trim(),
      note: note.trim(),
    };
    await savingApi({ action: "save", entry }, status === "wishlist" ? "위시리스트에 담음" : "저장됨");
    setResult(null); setText(""); setImageData(null); setImagePreview(null);
    setCompanions(""); setNote("");
    setTab("feed");
    refresh();
  }

  // 추천 술을 셀러/위시리스트로 저장
  async function saveFromRec(rec, myScore, status) {
    const d = recDetail[rec.name] || {};
    const entry = {
      id: Date.now(),
      date: kstNow(),
      name: rec.name,
      kind: rec.kind,
      resembles: rec.why || "",
      predictedScore: rec.predictedScore ?? d.predictedScore ?? null,
      reason: d.profile || rec.why || "",
      myScore: myScore ?? null,
      image: "",
      status: status || "tasted",
      axes: d.axes || null,
      subtype: d.subtype || rec.subtype || "",
    };
    await savingApi({ action: "save", entry }, status === "wishlist" ? "위시리스트에 담음" : "셀러에 저장됨");
    refresh();
  }

  async function setScore(id, score) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, myScore: score } : e)));
    await savingApi({ action: "setScore", id, myScore: score }, "점수 저장됨");
  }

  // 기존 기록의 특성 막대를 생성(detail 호출 → axes 추출 → 시트 저장)
  async function analyzeAxes(entry) {
    setAxesLoading(entry.id);
    try {
      const d = await api({ action: "detail", name: entry.name, kind: entry.kind });
      const patch = {};
      if (d && d.axes) patch.axes = d.axes;
      // 예측 점수가 비어있으면 함께 채움
      if (d && d.predictedScore != null && entry.predictedScore == null) {
        patch.predictedScore = d.predictedScore;
      }
      if (Object.keys(patch).length) {
        setEntries((prev) => prev.map((x) => (x.id === entry.id ? { ...x, ...patch } : x)));
        if (patch.axes) await api({ action: "setAxes", id: entry.id, axes: patch.axes });
        if (patch.predictedScore != null) await api({ action: "setPredicted", id: entry.id, predictedScore: patch.predictedScore });
      }
    } catch (e) {
      setError("특성 분석에 실패했어요.");
      setTimeout(() => setError(null), 2000);
    } finally {
      setAxesLoading(null);
    }
  }

  // 예측 점수만 도출(점수가 비어있는 기존 셀러 항목 보정)
  async function derivePredicted(entry) {
    setAxesLoading(entry.id);
    try {
      const d = await api({ action: "detail", name: entry.name, kind: entry.kind });
      const patch = {};
      if (d && d.predictedScore != null) patch.predictedScore = d.predictedScore;
      if (d && d.axes && !entry.axes) patch.axes = d.axes;
      if (Object.keys(patch).length) {
        setEntries((prev) => prev.map((x) => (x.id === entry.id ? { ...x, ...patch } : x)));
        if (patch.predictedScore != null) await savingApi({ action: "setPredicted", id: entry.id, predictedScore: patch.predictedScore }, "예측 점수 도출됨");
        if (patch.axes) await api({ action: "setAxes", id: entry.id, axes: patch.axes });
      }
    } catch (e) {
      setError("예측 점수 도출에 실패했어요.");
      setTimeout(() => setError(null), 2000);
    } finally {
      setAxesLoading(null);
    }
  }

  // 셀러 술의 페어링 도출(detail의 pairing). 시트엔 저장 안 하고 화면 상태에만.
  async function loadPairing(entry) {
    setPairingLoading(entry.id);
    try {
      const d = await api({ action: "detail", name: entry.name, kind: entry.kind });
      if (d && d.pairing) {
        setEntries((prev) => prev.map((x) => (x.id === entry.id ? { ...x, pairing: d.pairing } : x)));
      } else {
        showToast("페어링을 찾지 못했어요", "error");
      }
    } catch (e) {
      showToast("페어링 도출 실패", "error");
    } finally {
      setPairingLoading(null);
    }
  }

  async function runFoodPairing() {
    if (!foodText.trim()) { showToast("음식을 입력해 주세요", "error"); return; }
    setFoodLoading(true);
    setFoodResult(null);
    try {
      const r = await api({ action: "pairFood", food: foodText.trim() });
      if (r.error) throw new Error(r.error);
      setFoodResult(r);
    } catch (e) {
      showToast("페어링 추천에 실패했어요", "error");
    } finally {
      setFoodLoading(false);
    }
  }

  async function loadProfile() {
    setProfileLoading(true);
    try {
      const r = await api({ action: "tasteProfile", rater: recFor === "common" ? "me" : recFor });
      setProfile(r);
    } catch (e) {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }

  // ── 월드컵 ──
  // 카테고리에 맞는 셀러 술 추출
  function cellarForCategory(cat) {
    return entries.filter((e) => {
      if (e.status === "wishlist") return false;
      if (cat === "whisky") return e.kind === "whisky";
      if (e.kind !== "wine") return false;
      // subtype이 있으면 그걸로 정확히 분류
      if (e.subtype) {
        if (cat === "champagne") return e.subtype === "champagne";
        if (cat === "white") return e.subtype === "white" || e.subtype === "sweet";
        if (cat === "red") return e.subtype === "red";
        return true;
      }
      // subtype 없는 기존 기록: 키워드로 추정(샴페인만 비교적 확실)
      const t = ((e.name || "") + " " + (e.resembles || "")).toLowerCase();
      if (cat === "champagne") return /샴페인|champagne|크레망|cr[ée]mant|스파클|sparkl|franciacorta|cava|trento|샹파뉴/.test(t);
      if (cat === "red") return /레드|red|루즈|rouge|피노 누아|pinot noir|카베르네|cabernet|메를로|merlot|시라|syrah|네비올로|nebbiolo|산지오베제|sangiovese/.test(t);
      if (cat === "white") return /화이트|white|블랑|blanc|샤르도네|chardonnay|리슬링|riesling|소비뇽|sauvignon|카리칸테|carricante/.test(t) && !/샴페인|champagne|스파클|sparkl/.test(t);
      return true;
    });
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  async function startWorldcup() {
    if (!wcCategory) return;
    setWcLoading(true);
    setWcChampion(null); setWcRunnerUp(null);
    try {
      let pool = [];
      // 셀러 후보
      if (wcSource === "cellar" || wcSource === "mix") {
        pool = cellarForCategory(wcCategory).map((e) => ({
          name: e.name, kind: e.kind, why: e.resembles || "", fromCellar: true,
        }));
      }
      // 이름 중복 제거 헬퍼
      const dedupe = (arr) => {
        const seen = new Set();
        return arr.filter((p) => { const k = (p.name || "").toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true; });
      };
      pool = dedupe(pool);

      // 셀러밖(AI 생성) — 목표 수를 채울 때까지 최대 2번 시도
      if (wcSource === "outside" || wcSource === "mix") {
        if (wcSource === "outside") pool = []; // 셀러밖만이면 셀러 제외
        let attempts = 0;
        while (pool.length < wcSize && attempts < 2) {
          const need = wcSize - pool.length;
          const exclude = pool.map((p) => p.name);
          // 넉넉히 요청(필요분 + 여유 4), AI가 적게 줄 것 대비
          const gen = await api({ action: "worldcupCandidates", category: wcCategory, count: need + 4, exclude });
          if (Array.isArray(gen) && gen.length) {
            gen.forEach((g) => pool.push({ name: g.name, kind: g.kind, why: g.why || "", fromCellar: false }));
            pool = dedupe(pool);
          } else break;
          attempts++;
        }
      }

      if (pool.length < 2) {
        setError("후보가 부족해요. '셀러밖 포함' 또는 '혼합'을 선택해 보세요.");
        setTimeout(() => setError(null), 2600);
        setWcLoading(false);
        return;
      }
      // 목표 크기로. 부족하면 가능한 2의 거듭제곱으로 축소하고 안내.
      let size = wcSize;
      while (size > pool.length) size = size / 2;
      if (size < 2) size = 2;
      if (size < wcSize) {
        setError(`후보가 ${pool.length}개라 ${size}강으로 진행해요.`);
        setTimeout(() => setError(null), 2800);
      }
      const round = shuffle(pool).slice(0, size);
      setWcRound(round);
      setWcPair(0);
      setWcWinners([]);
    } catch (e) {
      setError("월드컵을 시작하지 못했어요.");
      setTimeout(() => setError(null), 2400);
    } finally {
      setWcLoading(false);
    }
  }

  function pickWinner(winner) {
    // 현재 맞대결의 두 후보
    const a = wcRound[wcPair * 2];
    const b = wcRound[wcPair * 2 + 1];
    const loser = winner === a ? b : a;
    const nextWinners = [...wcWinners, winner];
    const nextPairStart = (wcPair + 1) * 2;
    if (nextPairStart >= wcRound.length) {
      // 라운드 종료
      if (nextWinners.length === 1) {
        // 직전이 결승이었음 → 우승=winner, 준우승=결승 패자
        finishWorldcup(winner, loser);
      } else {
        setWcRound(nextWinners);
        setWcWinners([]);
        setWcPair(0);
      }
    } else {
      setWcWinners(nextWinners);
      setWcPair(wcPair + 1);
    }
  }

  async function finishWorldcup(champion, runnerUp) {
    setWcChampion(champion);
    setWcRunnerUp(runnerUp || null);
    // 우승 술이 셀러에 없으면 위시리스트에 자동 추가(취향 신호)
    if (champion && !champion.fromCellar) {
      const exists = entries.some((e) => (e.name || "").toLowerCase() === champion.name.toLowerCase());
      if (!exists) {
        const entry = {
          id: Date.now(), date: kstNow(),
          name: champion.name, kind: champion.kind, resembles: champion.why || "월드컵 우승",
          predictedScore: null, reason: "월드컵에서 선택한 술", myScore: null,
          image: "", status: "wishlist", axes: null,
        };
        await savingApi({ action: "save", entry }, "우승작 위시리스트에 담음");
        refresh();
      }
    }
  }

  function resetWorldcup() {
    setWcRound(null); setWcPair(0); setWcWinners([]);
    setWcChampion(null); setWcRunnerUp(null);
  }


  // 평가자별 점수 설정. rater="me"면 내 점수, 그 외 이름이면 친구 점수.
  async function setRating(id, rater, score) {
    setEntries((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      if (rater === "me" || rater === "나") return { ...e, myScore: score, status: "tasted" };
      const scores = { ...(e.scores || {}), [rater]: score };
      return { ...e, scores, status: "tasted" };
    }));
    await savingApi({ action: "setRating", id, rater, score }, "점수 저장됨");
    if (rater !== "me" && rater !== "나" && !raters.includes(rater)) {
      setRaters((prev) => [...prev, rater]);
    }
  }

  // 위시리스트 항목을 마셔봄 → 평가 + tasted 전환
  async function tasteItem(id, score) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, myScore: score, status: "tasted" } : e)));
    await savingApi({ action: "taste", id, myScore: score }, "점수 저장됨");
  }

  const [pendingDelete, setPendingDelete] = useState(null); // {entry, timer}
  function removeEntry(id) {
    const target = entries.find((e) => e.id === id);
    if (!target) return;
    // 화면에서 즉시 숨기고, 되돌리기 토스트 표시. 일정 시간 뒤 실제 삭제.
    setEntries((prev) => prev.filter((e) => e.id !== id));
    const timer = setTimeout(() => {
      api({ action: "delete", id });
      setPendingDelete(null);
    }, 5000);
    setPendingDelete({ entry: target, timer });
  }
  function undoDelete() {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timer);
    setEntries((prev) => [pendingDelete.entry, ...prev]);
    setPendingDelete(null);
  }

  // 백업 내보내기: 현재 기록을 JSON 파일로 다운로드
  function exportData() {
    try {
      const data = { app: "Vino·Diary", version: APP_VERSION, exportedAt: kstNow(), entries };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vinodiary-backup-${kstDate()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("백업 파일을 내려받았어요", "done");
    } catch (e) {
      showToast("내보내기 실패", "error");
    }
  }

  const importRef = useRef(null);
  async function importData(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const txt = await file.text();
      const data = JSON.parse(txt);
      const list = Array.isArray(data) ? data : data.entries;
      if (!Array.isArray(list) || !list.length) {
        showToast("가져올 기록이 없어요", "error");
        return;
      }
      // 이미 있는 이름은 건너뛰고 새 기록만 추가
      const have = new Set(entries.map((x) => (x.name || "").toLowerCase()));
      const fresh = list.filter((x) => x && x.name && !have.has(x.name.toLowerCase()));
      if (!fresh.length) {
        showToast("새로 추가할 기록이 없어요", "done");
        return;
      }
      showToast(`${fresh.length}개 가져오는 중…`, "loading");
      for (const it of fresh) {
        const entry = {
          id: Date.now() + Math.floor(Math.random() * 100000),
          date: it.date || kstNow(),
          name: it.name, kind: it.kind || "wine",
          resembles: it.resembles || "",
          predictedScore: it.predictedScore ?? null,
          reason: it.reason || "",
          myScore: it.myScore ?? null,
          image: "",
          status: it.status || "tasted",
          scores: it.scores || {},
          axes: it.axes || null,
          subtype: it.subtype || "",
        };
        await api({ action: "save", entry });
      }
      showToast(`${fresh.length}개 가져왔어요`, "done");
      refresh();
    } catch (err) {
      showToast("가져오기 실패 — 파일을 확인하세요", "error");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  async function loadRecs() {
    setRecLoading(true); setRecs(null); setProfile(null);
    try {
      const r = await api({ action: "recommend", forWhom: recFor });
      setRecs(Array.isArray(r) ? r : []);
    } catch (e) {
      setRecs([]);
    } finally {
      setRecLoading(false);
    }
  }

  const [recMoreLoading, setRecMoreLoading] = useState(false);
  async function loadMoreRecs() {
    if (!recs || !recs.length) return;
    setRecMoreLoading(true);
    try {
      const exclude = recs.map((r) => r.name);
      const r = await api({ action: "recommend", forWhom: recFor, exclude });
      if (Array.isArray(r) && r.length) {
        // 중복 이름 제거하며 이어붙이기
        const have = new Set(recs.map((x) => x.name));
        const fresh = r.filter((x) => !have.has(x.name));
        setRecs((prev) => [...prev, ...fresh]);
      }
    } catch (e) {
      setError("더 불러오지 못했어요.");
      setTimeout(() => setError(null), 2000);
    } finally {
      setRecMoreLoading(false);
    }
  }

  const [merging, setMerging] = useState(false);
  async function mergeAll() {
    setMerging(true);
    try {
      const r = await api({ action: "mergeAll" });
      await refresh();
      if (r && typeof r.removed === "number") {
        // 간단 피드백
        setError(r.removed > 0 ? `중복 ${r.removed}건을 합쳤어요.` : "합칠 중복이 없어요.");
        setTimeout(() => setError(null), 2500);
      }
    } catch (e) {
      setError("합치기에 실패했어요.");
    } finally {
      setMerging(false);
    }
  }

  async function loadRecDetail(name, kind) {
    if (recDetail[name]) {
      setRecDetail((p) => ({ ...p, [name]: { ...p[name], _open: !p[name]._open } }));
      return;
    }
    setRecDetailLoading(name);
    try {
      const r = await api({ action: "detail", name, kind });
      setRecDetail((p) => ({ ...p, [name]: { ...r, _open: true } }));
    } catch (e) {
      setRecDetail((p) => ({ ...p, [name]: { error: true, _open: true } }));
    } finally {
      setRecDetailLoading(null);
    }
  }

  // ---------- 설정 화면 ----------
  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text,
        fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center",
        justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 420, width: "100%" }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: C.goldDim, fontWeight: 600 }}>
            TASTE JOURNAL
          </div>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 500, fontSize: 30,
            margin: "4px 0 18px" }}>
            Vino<span style={{ color: C.gold }}>·</span>Diary
            <span style={{ fontSize: 12, color: C.goldDim, fontFamily: "system-ui, sans-serif",
              marginLeft: 8, letterSpacing: 0, verticalAlign: "middle" }}>{APP_VERSION}</span>
          </h1>
          <p style={{ color: C.sub, fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>
            처음이시군요. Apps Script로 배포한 <b style={{ color: C.text }}>Web App URL</b>을
            입력하면 기록이 Google Sheet에 저장돼 기기 간 동기화됩니다.
          </p>
          <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://script.google.com/macros/s/…/exec"
            style={{ width: "100%", boxSizing: "border-box", background: C.panel,
              border: `1px solid ${C.line}`, borderRadius: 10, color: C.text, padding: 12,
              fontSize: 13, marginBottom: 12 }} />
          <button onClick={saveUrl} style={{ width: "100%", padding: 14, background: C.gold,
            color: "#1B160C", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15,
            cursor: "pointer" }}>
            연결하기
          </button>
          {error && <div style={{ color: "#D98", marginTop: 10, fontSize: 13 }}>{error}</div>}
        </div>
      </div>
    );
  }

  // ---------- 메인 ----------
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text,
      fontFamily: "system-ui, sans-serif", paddingBottom: 80 }}>
      <header style={{ padding: "22px 20px 14px", borderBottom: `1px solid ${C.line}`,
        display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 4, color: C.goldDim, fontWeight: 600 }}>
            TASTE JOURNAL
          </div>
          <h1 style={{ margin: "4px 0 0", fontFamily: "Georgia, serif", fontWeight: 500,
            fontSize: 28, letterSpacing: 1 }}>
            Vino<span style={{ color: C.gold }}>·</span>Diary
            <span style={{ fontSize: 11, color: C.goldDim, fontFamily: "system-ui, sans-serif",
              marginLeft: 8, letterSpacing: 0, verticalAlign: "middle" }}>{APP_VERSION}</span>
          </h1>
        </div>
        <button onClick={refresh} style={{ background: "none", border: `1px solid ${C.line}`,
          color: syncing ? C.gold : C.sub, borderRadius: 8, padding: "6px 10px", fontSize: 12,
          cursor: "pointer" }}>
          {syncing ? "동기화…" : "↻ 새로고침"}
        </button>
      </header>

      <main style={{ padding: "18px 16px", maxWidth: 560, margin: "0 auto" }}>
        {tab === "feed" && (
          <section>
            {/* 인사 + 이름 설정 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: C.goldDim, letterSpacing: 2 }}>MY DIARY</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <input value={userName} onChange={(e) => saveName(e.target.value)}
                  placeholder="이름을 입력하세요"
                  style={{ flex: 1, background: "transparent", border: "none",
                    borderBottom: `1px solid ${C.line}`, color: C.text, padding: "4px 0",
                    fontSize: 22, fontFamily: "Georgia, serif" }} />
                <span style={{ fontSize: 15, color: C.sub }}>의 술 일기</span>
              </div>
            </div>

            {(() => {
              const tasted = entries.filter((e) => e.status !== "wishlist");
              if (tasted.length === 0) {
                return (
                  <div style={{ textAlign: "center", color: C.sub, padding: "50px 20px" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📖</div>
                    <div style={{ fontSize: 14, color: C.text, marginBottom: 6 }}>아직 일기가 비어 있어요</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
                      술을 분석하고 사진·메모와 함께 저장하면<br />여기에 일기로 쌓여요.
                    </div>
                    <button onClick={() => setTab("add")}
                      style={{ padding: "12px 24px", background: C.gold, color: "#1B160C", border: "none",
                        borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                      첫 기록 남기기
                    </button>
                  </div>
                );
              }
              const sorted = [...tasted].sort((a, b) => Number(b.id) - Number(a.id));
              return sorted.map((e) => {
                const myS = e.myScore;
                const friendScores = e.scores ? Object.keys(e.scores) : [];
                return (
                  <div key={e.id} style={{ background: C.panel, border: `1px solid ${C.line}`,
                    borderRadius: 16, overflow: "hidden", marginBottom: 14 }}>
                    {e.image ? (
                      <img src={e.image} alt="" style={{ width: "100%", maxHeight: 320,
                        objectFit: "cover", display: "block" }}
                        onError={(ev) => { ev.target.style.display = "none"; }} />
                    ) : null}
                    <div style={{ padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%",
                              background: e.kind === "whisky" ? C.whisky : C.wine }} />
                            <span style={{ fontSize: 10, color: C.sub, letterSpacing: 1 }}>{e.date}</span>
                          </div>
                          <div style={{ fontFamily: "Georgia, serif", fontSize: 18, margin: "4px 0" }}>{e.name}</div>
                        </div>
                        {(myS != null) && (
                          <div style={{ flexShrink: 0, width: 46, height: 46, borderRadius: "50%",
                            border: `2px solid ${C.gold}`, display: "flex", alignItems: "center",
                            justifyContent: "center", fontSize: 15, fontWeight: 700, color: C.gold }}>
                            {myS}
                          </div>
                        )}
                      </div>
                      {e.companions && (
                        <div style={{ fontSize: 13, color: C.gold, marginTop: 4 }}>👥 {e.companions}</div>
                      )}
                      {e.note && (
                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, marginTop: 8,
                          whiteSpace: "pre-wrap" }}>{e.note}</div>
                      )}
                      {e.resembles && (
                        <div style={{ fontSize: 12, color: C.sub, marginTop: 8, lineHeight: 1.5 }}>{e.resembles}</div>
                      )}
                      {friendScores.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                          {friendScores.map((n) => (
                            <span key={n} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10,
                              background: C.panel2, color: C.text }}>{n} {e.scores[n]}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </section>
        )}

        {tab === "add" && (
          <section>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {[["single", "한 병"], ["menu", "메뉴판"]].map(([k, label]) => {
                const sel = analyzeMode === k;
                return (
                  <button key={k} onClick={() => setAnalyzeMode(k)}
                    style={{ flex: 1, padding: "9px 0", fontSize: 13,
                      background: sel ? C.gold : C.panel, color: sel ? "#1B160C" : C.sub,
                      border: `1px solid ${sel ? C.gold : C.line}`, borderRadius: 10,
                      cursor: "pointer", fontWeight: sel ? 700 : 400 }}>{label}</button>
                );
              })}
            </div>
            {analyzeMode === "single" && (raters.length > 0) && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: C.goldDim, letterSpacing: 1, marginBottom: 6 }}>
                  누구 취향으로 분석할까요?
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[["me", "나"]].concat(raters.map((n) => [n, n])).map(([k, label]) => {
                    const sel = analyzeFor === k;
                    return (
                      <button key={k} onClick={() => setAnalyzeFor(k)}
                        style={{ padding: "6px 14px", fontSize: 13, borderRadius: 16,
                          background: sel ? C.gold : C.panel, color: sel ? "#1B160C" : C.sub,
                          border: `1px solid ${sel ? C.gold : C.line}`, cursor: "pointer",
                          fontWeight: sel ? 700 : 400 }}>{label}</button>
                    );
                  })}
                </div>
              </div>
            )}
            {imagePreview ? (
              <div style={{ position: "relative", marginBottom: 14, textAlign: "center" }}>
                <img src={imagePreview} alt="" style={{ maxHeight: 260, borderRadius: 12,
                  border: `1px solid ${C.line}` }} />
                <button onClick={() => { setImageData(null); setImagePreview(null); }}
                  style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28,
                    borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff",
                    border: "none", fontSize: 16, cursor: "pointer" }}>×</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                <button onClick={() => cameraRef.current?.click()}
                  style={{ flex: 1, padding: "22px 0", background: C.panel,
                    border: `1px dashed ${C.line}`, borderRadius: 14, cursor: "pointer", color: C.sub }}>
                  <div style={{ fontSize: 26, marginBottom: 4 }}>📷</div>
                  <div style={{ fontSize: 13 }}>사진 찍기</div>
                </button>
                <button onClick={() => fileRef.current?.click()}
                  style={{ flex: 1, padding: "22px 0", background: C.panel,
                    border: `1px dashed ${C.line}`, borderRadius: 14, cursor: "pointer", color: C.sub }}>
                  <div style={{ fontSize: 26, marginBottom: 4 }}>🖼️</div>
                  <div style={{ fontSize: 13 }}>갤러리에서 고르기</div>
                </button>
              </div>
            )}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment"
              onChange={onPickImage} style={{ display: "none" }} />
            <input ref={fileRef} type="file" accept="image/*"
              onChange={onPickImage} style={{ display: "none" }} />

            <textarea value={text} onChange={(e) => setText(e.target.value)}
              placeholder={analyzeMode === "menu"
                ? "또는 와인 리스트를 붙여넣어도 돼요. 한 줄에 하나씩."
                : "또는 술에 대해 이야기해 주세요. 예: 에트나의 카리칸테 화이트, 짠 미네랄에 산도 높음"}
              rows={3} style={{ width: "100%", boxSizing: "border-box", background: C.panel,
                border: `1px solid ${C.line}`, borderRadius: 12, color: C.text, padding: 12,
                fontSize: 14, resize: "vertical", marginBottom: 12 }} />

            {analyzeMode === "menu" ? (
              <button onClick={runMenuAnalyze} disabled={menuLoading}
                style={{ width: "100%", padding: 14, background: C.gold, color: "#1B160C",
                  border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
                  cursor: "pointer", opacity: menuLoading ? 0.6 : 1 }}>
                {menuLoading ? "읽는 중…" : "메뉴판에서 내 취향 찾기"}
              </button>
            ) : (
            <button onClick={onAnalyze} disabled={analyzing || candLoading}
              style={{ width: "100%", padding: 14, background: C.gold, color: "#1B160C",
                border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
                cursor: "pointer", opacity: (analyzing || candLoading) ? 0.6 : 1 }}>
              {candLoading ? "후보 찾는 중…" : analyzing ? "분석 중…" : "내 취향으로 분석하기"}
            </button>
            )}

            {error && <div style={{ color: "#D98", marginTop: 12, fontSize: 13 }}>{error}</div>}

            {/* 단일 분석: 후보 목록(여럿일 때) */}
            {analyzeMode === "single" && candidates && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 12, color: C.goldDim, marginBottom: 10, letterSpacing: 1 }}>
                  어떤 술인가요? 골라 주세요
                </div>
                {candidates.map((c, i) => (
                  <button key={i} onClick={() => analyzeOne(c.name, c.kind)}
                    style={{ width: "100%", textAlign: "left", marginBottom: 8, padding: 14,
                      background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12,
                      cursor: "pointer", color: C.text }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%",
                        background: c.kind === "whisky" ? C.whisky : C.wine }} />
                      <span style={{ fontFamily: "Georgia, serif", fontSize: 16 }}>{c.name}</span>
                    </div>
                    {c.hint && <div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>{c.hint}</div>}
                  </button>
                ))}
                <button onClick={() => setCandidates(null)}
                  style={{ width: "100%", marginTop: 4, padding: 10, background: "transparent",
                    color: C.sub, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12,
                    cursor: "pointer" }}>다시 검색</button>
              </div>
            )}

            {/* 메뉴판 결과 */}
            {analyzeMode === "menu" && menuResult && menuResult.items && (
              <div style={{ marginTop: 18 }}>
                {menuResult.note && (
                  <div style={{ fontSize: 12, color: C.sub, marginBottom: 12, lineHeight: 1.5,
                    fontStyle: "italic" }}>{menuResult.note}</div>
                )}
                {menuResult.items.map((it, i) => {
                  const top3 = i < 3;
                  return (
                    <div key={i} style={{ background: C.panel,
                      border: `1px solid ${top3 ? C.gold : C.line}`, borderRadius: 14,
                      padding: 14, marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: top3 ? C.gold : C.panel2, color: top3 ? "#1B160C" : C.sub,
                          fontWeight: 700, fontSize: 14 }}>
                          {top3 ? "★" : i + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%",
                              background: it.kind === "whisky" ? C.whisky : C.wine }} />
                            <span style={{ fontSize: 10, color: C.sub, letterSpacing: 1 }}>
                              예측 {it.predictedScore}
                            </span>
                          </div>
                          <div style={{ fontFamily: "Georgia, serif", fontSize: 16, margin: "2px 0" }}>
                            {it.name}
                          </div>
                          <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.4 }}>{it.why}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                        <button onClick={() => saveMenuItem(it, "wishlist")}
                          style={{ flex: 1, padding: "8px", background: "transparent", color: C.gold,
                            border: `1px solid ${C.goldDim}`, borderRadius: 8, fontSize: 12,
                            cursor: "pointer" }}>✧ 위시리스트</button>
                        <button onClick={() => saveMenuItem(it, "tasted")}
                          style={{ flex: 1, padding: "8px", background: "transparent", color: C.sub,
                            border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12,
                            cursor: "pointer" }}>셀러에 저장</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {result && analyzeMode === "single" && (
              <div style={{ marginTop: 18, background: C.panel, border: `1px solid ${C.line}`,
                borderRadius: 16, padding: 18 }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <ScoreRing value={result.predictedScore} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: C.goldDim, letterSpacing: 1 }}>
                      {result.kind === "whisky" ? "WHISKY" : "WINE"} · 예측 선호도
                    </div>
                    <div style={{ fontFamily: "Georgia, serif", fontSize: 19, marginTop: 2 }}>
                      {result.name}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 14, fontSize: 13, color: C.sub, lineHeight: 1.5 }}>
                  <b style={{ color: C.gold }}>닮은 것</b> · {result.resembles}
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: C.text, lineHeight: 1.6 }}>
                  {result.reason}
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: C.sub }}>
                  신뢰도: {result.confidence} · {(analyzeFor === "me" || analyzeFor === "나") ? "내" : analyzeFor + "의"} 예측 점수(추정)
                </div>
                {result.axes && (
                  <div style={{ marginTop: 12 }}>
                    <span style={{ color: C.gold, fontSize: 11, letterSpacing: 1 }}>특성</span>
                    <AxisBars axes={result.axes} />
                  </div>
                )}
                <div style={{ marginTop: 16, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
                  {/* 함께한 사람 · 메모 */}
                  <input value={companions} onChange={(e) => setCompanions(e.target.value)}
                    placeholder="누구와 함께? (예: 유진, 동생)"
                    style={{ width: "100%", boxSizing: "border-box", background: C.panel2,
                      border: `1px solid ${C.line}`, borderRadius: 8, color: C.text,
                      padding: "9px 12px", fontSize: 13, marginBottom: 8 }} />
                  <textarea value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="어떻게 마셨는지, 어떤 느낌이었는지 메모"
                    rows={2} style={{ width: "100%", boxSizing: "border-box", background: C.panel2,
                      border: `1px solid ${C.line}`, borderRadius: 8, color: C.text,
                      padding: "9px 12px", fontSize: 13, marginBottom: 12, resize: "vertical" }} />
                  <div style={{ fontSize: 12, color: C.sub, marginBottom: 8 }}>
                    이미 마셔봤다면 점수를 입력하세요
                  </div>
                  <ScoreInput onSubmit={(s) => saveResult(s)} />
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={() => saveResult(null)}
                      style={{ flex: 1, padding: 11, background: "transparent",
                        color: C.gold, border: `1px solid ${C.goldDim}`, borderRadius: 8,
                        fontSize: 13, cursor: "pointer" }}>
                      예측치로 저장
                    </button>
                    <button onClick={() => saveResult(null, "wishlist")}
                      style={{ flex: 1, padding: 11, background: "transparent",
                        color: C.gold, border: `1px solid ${C.goldDim}`, borderRadius: 8,
                        fontSize: 13, cursor: "pointer" }}>
                      ✧ 위시리스트로
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "cellar" && (
          <section>
            {entries.length === 0 && (
              <div style={{ textAlign: "center", color: C.sub, padding: "50px 20px" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🍷</div>
                <div style={{ fontSize: 15, color: C.text, marginBottom: 6 }}>아직 기록이 없어요</div>
                <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
                  마셔봤거나 궁금한 술을 분석해<br />나만의 취향 다이어리를 시작해 보세요.
                </div>
                <button onClick={() => setTab("add")}
                  style={{ padding: "12px 24px", background: C.gold, color: "#1B160C", border: "none",
                    borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  첫 술 분석하기
                </button>
              </div>
            )}
            {(() => {
              const names = entries.map((e) => (e.name || "").toLowerCase().replace(/\s+/g, ""));
              const hasDup = names.some((n, i) => n && names.indexOf(n) !== i);
              return hasDup ? (
                <button onClick={mergeAll} disabled={merging}
                  style={{ width: "100%", padding: "11px", marginBottom: 12, background: "transparent",
                    color: C.gold, border: `1px solid ${C.goldDim}`, borderRadius: 10, fontSize: 13,
                    cursor: "pointer", opacity: merging ? 0.6 : 1 }}>
                  {merging ? "합치는 중…" : "⊟ 같은 술 중복 합치기"}
                </button>
              ) : null;
            })()}
            {error && tab === "cellar" && (
              <div style={{ color: C.gold, fontSize: 13, marginBottom: 10, textAlign: "center" }}>
                {error}
              </div>
            )}
            {/* 요약 통계 */}
            {entries.length > 0 && (() => {
              const tasted = entries.filter((e) => e.status !== "wishlist");
              const wish = entries.filter((e) => e.status === "wishlist").length;
              const rated = tasted.filter((e) => e.myScore != null);
              const avg = rated.length ? Math.round(rated.reduce((s, e) => s + e.myScore, 0) / rated.length) : null;
              const wine = tasted.filter((e) => e.kind === "wine").length;
              const whisky = tasted.filter((e) => e.kind === "whisky").length;
              return (
                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  {[["병", tasted.length], ["평균", avg != null ? avg : "—"],
                    ["와인", wine], ["위스키", whisky], ["위시", wish]].map(([label, val], i) => (
                    <div key={i} style={{ flex: "1 0 17%", background: C.panel,
                      border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 4px",
                      textAlign: "center" }}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: C.gold, fontFamily: "Georgia, serif" }}>{val}</div>
                      <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
            {entries.length > 0 && (
              <div style={{ position: "relative", marginBottom: 10 }}>
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="술 이름 검색 (한글·영문·부분)"
                  style={{ width: "100%", boxSizing: "border-box", background: C.panel,
                    border: `1px solid ${C.line}`, borderRadius: 10, color: C.text,
                    padding: "10px 34px 10px 12px", fontSize: 14 }} />
                {search && (
                  <button onClick={() => setSearch("")}
                    style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", color: C.sub, fontSize: 18, cursor: "pointer" }}>×</button>
                )}
              </div>
            )}
            {entries.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: C.goldDim, letterSpacing: 1 }}>정렬</span>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                  style={{ flex: 1, background: C.panel, color: C.text, border: `1px solid ${C.line}`,
                    borderRadius: 8, padding: "8px 10px", fontSize: 13, cursor: "pointer" }}>
                  <option value="recent">최신순</option>
                  <option value="oldest">오래된순</option>
                  <option value="scoreHigh">내 점수 높은순</option>
                  <option value="scoreLow">내 점수 낮은순</option>
                  <option value="predHigh">예측 점수 높은순</option>
                  {raters.map((n) => (
                    <option key={n} value={`friend:${n}`}>{n} 점수 높은순</option>
                  ))}
                </select>
              </div>
            )}
            {entries.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                {[["all", "전체"], ["wine", "와인"], ["whisky", "위스키"], ["wishlist", "위시리스트"]].map(([k, label]) => {
                  const isWish = k === "wishlist";
                  const count = isWish ? entries.filter((e) => e.status === "wishlist").length : 0;
                  return (
                  <button key={k} onClick={() => setKindFilter(k)}
                    style={{ flex: isWish ? "1 0 100%" : 1, padding: "8px 0", fontSize: 13,
                      background: kindFilter === k ? C.gold : C.panel,
                      color: kindFilter === k ? "#1B160C" : C.sub,
                      border: `1px solid ${kindFilter === k ? C.gold : C.line}`,
                      borderRadius: 8, cursor: "pointer", fontWeight: kindFilter === k ? 700 : 400 }}>
                    {label}{isWish && count > 0 ? ` (${count})` : ""}
                  </button>
                  );
                })}
              </div>
            )}
            {entries
              .filter((e) => {
                if (kindFilter === "wishlist") {
                  if (e.status !== "wishlist") return false;
                } else {
                  if (e.status === "wishlist") return false;
                  if (!(kindFilter === "all" || e.kind === kindFilter)) return false;
                }
                // 검색: 이름 + 닮은 것, 대소문자·부분 매칭
                if (search.trim()) {
                  const q = search.trim().toLowerCase();
                  const hay = ((e.name || "") + " " + (e.resembles || "")).toLowerCase();
                  if (!hay.includes(q)) return false;
                }
                return true;
              })
              .sort((a, b) => {
                const myA = a.myScore != null ? a.myScore : -1;
                const myB = b.myScore != null ? b.myScore : -1;
                const prA = a.predictedScore != null ? a.predictedScore : -1;
                const prB = b.predictedScore != null ? b.predictedScore : -1;
                switch (sortBy) {
                  case "recent":   return Number(b.id) - Number(a.id);
                  case "oldest":   return Number(a.id) - Number(b.id);
                  case "scoreHigh": return myB - myA || Number(b.id) - Number(a.id);
                  case "scoreLow":  return myA - myB || Number(b.id) - Number(a.id);
                  case "predHigh":  return prB - prA || Number(b.id) - Number(a.id);
                  default:
                    // friend:이름 → 그 친구 점수 높은순
                    if (sortBy.startsWith("friend:")) {
                      const nm = sortBy.slice(7);
                      const fa = (a.scores && a.scores[nm] != null) ? a.scores[nm] : -1;
                      const fb = (b.scores && b.scores[nm] != null) ? b.scores[nm] : -1;
                      return fb - fa || Number(b.id) - Number(a.id);
                    }
                    return Number(b.id) - Number(a.id);
                }
              })
              .map((e) => {
              const open = expandedId === e.id;
              const isWish = e.status === "wishlist";
              return (
              <div key={e.id} style={{ background: C.panel, border: `1px solid ${open ? C.goldDim : C.line}`,
                borderRadius: 14, padding: 14, marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                    flexShrink: 0, gap: 3 }}>
                    <ScoreRing value={e.myScore ?? e.predictedScore} size={54} />
                    {(e.myScore != null || e.predictedScore != null) && (
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                        color: e.myScore != null ? C.gold : C.sub }}>
                        {e.myScore != null ? "내 점수" : "예측"}
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                    onClick={() => setExpandedId(open ? null : e.id)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%",
                        background: e.kind === "whisky" ? C.whisky : C.wine }} />
                      <span style={{ fontSize: 10, color: C.sub, letterSpacing: 1 }}>
                        {e.kind === "whisky" ? "WHISKY" : "WINE"}{isWish ? " · 위시리스트" : ""} · {e.date}
                      </span>
                    </div>
                    <div style={{ fontFamily: "Georgia, serif", fontSize: 16, margin: "3px 0",
                      whiteSpace: open ? "normal" : "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {e.name}
                    </div>
                    <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.4 }}>{e.resembles}</div>
                  </div>
                  <button onClick={() => removeEntry(e.id)}
                    style={{ background: "none", border: "none", color: C.line, fontSize: 18,
                      cursor: "pointer", alignSelf: "flex-start" }}>×</button>
                </div>

                {/* 펼침 상세 */}
                {open && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}`,
                    fontSize: 13, lineHeight: 1.6 }}>
                    {e.reason && (
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ color: C.gold, fontSize: 11, letterSpacing: 1 }}>분석 근거</span>
                        <div style={{ color: C.text, marginTop: 2 }}>{e.reason}</div>
                      </div>
                    )}
                    {/* 특성 막대 */}
                    {e.axes ? (
                      <div style={{ marginBottom: 10 }}>
                        <span style={{ color: C.gold, fontSize: 11, letterSpacing: 1 }}>특성</span>
                        <AxisBars axes={e.axes} />
                      </div>
                    ) : (
                      <button onClick={() => analyzeAxes(e)} disabled={axesLoading === e.id}
                        style={{ marginBottom: 10, padding: "6px 12px", fontSize: 12,
                          background: "transparent", color: C.gold, border: `1px solid ${C.goldDim}`,
                          borderRadius: 8, cursor: "pointer" }}>
                        {axesLoading === e.id ? "분석 중…" : "특성 막대 분석하기"}
                      </button>
                    )}
                    {/* 페어링 */}
                    {e.pairing ? (
                      <div style={{ marginBottom: 10 }}>
                        <span style={{ color: C.gold, fontSize: 11, letterSpacing: 1 }}>🍽 페어링</span>
                        <div style={{ color: C.text, marginTop: 2, fontSize: 13, lineHeight: 1.5 }}>{e.pairing}</div>
                      </div>
                    ) : (
                      <button onClick={() => loadPairing(e)} disabled={pairingLoading === e.id}
                        style={{ marginBottom: 10, marginLeft: 6, padding: "6px 12px", fontSize: 12,
                          background: "transparent", color: C.gold, border: `1px solid ${C.goldDim}`,
                          borderRadius: 8, cursor: "pointer" }}>
                        {pairingLoading === e.id ? "찾는 중…" : "🍽 페어링 보기"}
                      </button>
                    )}
                    {/* 평가자별 점수 */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
                      {e.predictedScore != null ? (
                        <span style={{ fontSize: 12, color: C.sub }}>예측 {e.predictedScore}</span>
                      ) : (
                        <button onClick={() => derivePredicted(e)} disabled={axesLoading === e.id}
                          style={{ fontSize: 11, padding: "3px 10px", borderRadius: 10,
                            background: "transparent", color: C.gold, border: `1px solid ${C.goldDim}`,
                            cursor: "pointer" }}>
                          {axesLoading === e.id ? "도출 중…" : "예측 점수 도출"}
                        </button>
                      )}
                      {e.myScore != null && (
                        <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 10,
                          background: C.panel2, color: C.gold }}>나 {e.myScore}</span>
                      )}
                      {e.scores && Object.keys(e.scores).map((n) => (
                        <span key={n} style={{ fontSize: 12, padding: "2px 8px", borderRadius: 10,
                          background: C.panel2, color: C.text }}>{n} {e.scores[n]}</span>
                      ))}
                    </div>

                    {/* 평가자 선택 + 점수 입력 */}
                    <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
                      <div style={{ fontSize: 11, color: C.goldDim, marginBottom: 6 }}>평가 추가/수정</div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                        {["나"].concat(raters).map((name) => {
                          const sel = (ratingFor[e.id] || "나") === name;
                          return (
                            <button key={name} onClick={() => setRatingFor((p) => ({ ...p, [e.id]: name }))}
                              style={{ padding: "4px 10px", fontSize: 12, borderRadius: 14,
                                background: sel ? C.gold : C.panel2, color: sel ? "#1B160C" : C.sub,
                                border: `1px solid ${sel ? C.gold : C.line}`, cursor: "pointer" }}>
                              {name}
                            </button>
                          );
                        })}
                        <button onClick={() => {
                          const nm = (prompt("친구 이름을 입력하세요") || "").trim();
                          if (nm) { setRatingFor((p) => ({ ...p, [e.id]: nm }));
                            if (!raters.includes(nm) && nm !== "나") setRaters((prev) => [...prev, nm]); }
                        }} style={{ padding: "4px 10px", fontSize: 12, borderRadius: 14,
                          background: "transparent", color: C.gold, border: `1px dashed ${C.goldDim}`,
                          cursor: "pointer" }}>+ 친구</button>
                      </div>
                      <ScoreInput onSubmit={(s) => {
                        const who = ratingFor[e.id] || "나";
                        setRating(e.id, who === "나" ? "me" : who, s);
                      }} />
                      <button onClick={() => {
                        const who = ratingFor[e.id] || "나";
                        const raterKey = who === "나" ? "me" : who;
                        // 화면 즉시 반영
                        setEntries((prev) => prev.map((x) => {
                          if (x.id !== e.id) return x;
                          if (raterKey === "me") return { ...x, myScore: null };
                          const sc = { ...(x.scores || {}) }; delete sc[who];
                          return { ...x, scores: sc };
                        }));
                        savingApi({ action: "unrate", id: e.id, rater: raterKey }, "평가 취소됨");
                      }}
                        style={{ width: "100%", marginTop: 8, padding: "9px", background: "transparent",
                          color: C.sub, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12,
                          cursor: "pointer" }}>
                        {(ratingFor[e.id] || "나")} 평가 취소(안 마셔봄)
                      </button>
                      {/* 전체를 위시리스트로 되돌리기 */}
                      <button onClick={() => {
                        setEntries((prev) => prev.map((x) => x.id === e.id
                          ? { ...x, myScore: null, scores: {}, status: "wishlist" } : x));
                        savingApi({ action: "unrate", id: e.id, rater: "all" }, "위시리스트로 되돌림");
                      }}
                        style={{ width: "100%", marginTop: 6, padding: "8px", background: "transparent",
                          color: C.goldDim, border: "none", fontSize: 11, cursor: "pointer" }}>
                        ✧ 전체 위시리스트로 되돌리기
                      </button>
                    </div>
                  </div>
                )}

                {/* 위시리스트: 펼치지 않아도 빠른 평가(나 기준) */}
                {isWish && !open && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: C.goldDim, marginBottom: 6 }}>마셔봤다면 평가하기 (카드를 펼치면 친구도 평가 가능)</div>
                    <ScoreInput onSubmit={(s) => tasteItem(e.id, s)} />
                  </div>
                )}
              </div>
              );
            })}
            {entries.length > 0 && search.trim() &&
              entries.filter((e) => {
                if (kindFilter === "wishlist") { if (e.status !== "wishlist") return false; }
                else { if (e.status === "wishlist") return false;
                  if (!(kindFilter === "all" || e.kind === kindFilter)) return false; }
                const q = search.trim().toLowerCase();
                const hay = ((e.name || "") + " " + (e.resembles || "")).toLowerCase();
                return hay.includes(q);
              }).length === 0 && (
                <div style={{ textAlign: "center", color: C.sub, padding: "30px 20px", fontSize: 13 }}>
                  "{search}"에 해당하는 술이 없어요.
                </div>
              )}
            {/* 데이터 관리 */}
            {entries.length > 0 && (
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
                <div style={{ fontSize: 11, color: C.goldDim, letterSpacing: 1, marginBottom: 8 }}>
                  데이터 백업
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={exportData}
                    style={{ flex: 1, padding: "10px", background: "transparent", color: C.sub,
                      border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
                    ↓ 내보내기(JSON)
                  </button>
                  <button onClick={() => importRef.current?.click()}
                    style={{ flex: 1, padding: "10px", background: "transparent", color: C.sub,
                      border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
                    ↑ 가져오기
                  </button>
                  <input ref={importRef} type="file" accept="application/json,.json"
                    onChange={importData} style={{ display: "none" }} />
                </div>
                <div style={{ fontSize: 11, color: C.sub, marginTop: 8, lineHeight: 1.5 }}>
                  내보내기로 기록을 파일로 저장해 두면 안전해요. 가져오기는 중복(같은 이름)을 빼고 추가합니다.
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "recommend" && (
          <section>
            {/* 음식 → 술 페어링 */}
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14,
              padding: 14, marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: C.goldDim, letterSpacing: 1, marginBottom: 8 }}>
                🍽 오늘 뭐 먹어요? 어울리는 술을 찾아드려요
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={foodText} onChange={(e) => setFoodText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runFoodPairing()}
                  placeholder="예: 양고기 스테이크, 굴, 떡볶이"
                  style={{ flex: 1, background: C.panel2, border: `1px solid ${C.line}`,
                    borderRadius: 8, color: C.text, padding: "10px 12px", fontSize: 14 }} />
                <button onClick={runFoodPairing} disabled={foodLoading}
                  style={{ padding: "0 16px", background: C.gold, color: "#1B160C", border: "none",
                    borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
                    opacity: foodLoading ? 0.6 : 1, whiteSpace: "nowrap" }}>
                  {foodLoading ? "…" : "찾기"}
                </button>
              </div>
              {foodResult && (
                <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6 }}>
                  {foodResult.fromCellar && foodResult.fromCellar.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <span style={{ color: C.gold, fontSize: 11, letterSpacing: 1 }}>내 셀러에서</span>
                      {foodResult.fromCellar.map((p, i) => (
                        <div key={i} style={{ marginTop: 4 }}>
                          <span style={{ color: C.text, fontWeight: 600 }}>{p.name}</span>
                          <span style={{ color: C.sub }}> — {p.why}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {foodResult.suggestions && foodResult.suggestions.length > 0 && (
                    <div style={{ marginBottom: foodResult.tip ? 10 : 0 }}>
                      <span style={{ color: C.goldDim, fontSize: 11, letterSpacing: 1 }}>이런 술도</span>
                      {foodResult.suggestions.map((p, i) => (
                        <div key={i} style={{ marginTop: 4 }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", display: "inline-block",
                            marginRight: 6, background: p.kind === "whisky" ? C.whisky : C.wine }} />
                          <span style={{ color: C.text, fontWeight: 600 }}>{p.name}</span>
                          <span style={{ color: C.sub }}> — {p.why}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {foodResult.tip && (
                    <div style={{ color: C.sub, fontSize: 12, fontStyle: "italic",
                      paddingTop: 8, borderTop: `1px solid ${C.line}` }}>{foodResult.tip}</div>
                  )}
                </div>
              )}
            </div>

            <div style={{ fontSize: 11, color: C.goldDim, marginBottom: 8, letterSpacing: 1 }}>
              누구의 취향으로 추천받을까요?
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {[["me", "나"], ["common", "다 같이"]].concat(raters.map((n) => [n, n])).map(([k, label]) => {
                const sel = recFor === k;
                return (
                  <button key={k} onClick={() => setRecFor(k)}
                    style={{ padding: "7px 14px", fontSize: 13, borderRadius: 16,
                      background: sel ? C.gold : C.panel, color: sel ? "#1B160C" : C.sub,
                      border: `1px solid ${sel ? C.gold : C.line}`, cursor: "pointer",
                      fontWeight: sel ? 700 : 400 }}>
                    {label}
                  </button>
                );
              })}
            </div>
            <button onClick={loadRecs} disabled={recLoading}
              style={{ width: "100%", padding: 14, background: C.gold, color: "#1B160C",
                border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
                cursor: "pointer", opacity: recLoading ? 0.6 : 1, marginBottom: 16 }}>
              {recLoading ? "고르는 중…" :
                recFor === "common" ? "다 같이 즐길 술 추천받기" :
                recFor === "me" ? "내 취향과 비슷한 술 추천받기" :
                `${recFor} 취향으로 추천받기`}
            </button>

            {/* 취향 일관/비일관 분석 */}
            <div style={{ marginBottom: 16 }}>
              <button onClick={loadProfile} disabled={profileLoading}
                style={{ width: "100%", padding: "10px", background: C.panel,
                  color: C.gold, border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 13,
                  cursor: "pointer", opacity: profileLoading ? 0.6 : 1 }}>
                {profileLoading ? "분석 중…" :
                  `${recFor === "common" || recFor === "me" ? "내" : recFor + "의"} 취향 패턴 보기`}
              </button>
              {profile && profile.enough === false && (
                <div style={{ marginTop: 8, fontSize: 12, color: C.sub, textAlign: "center" }}>
                  {profile.note}
                </div>
              )}
              {profile && profile.enough && (
                <div style={{ marginTop: 10, background: C.panel, border: `1px solid ${C.line}`,
                  borderRadius: 12, padding: 14, fontSize: 13, lineHeight: 1.6 }}>
                  {profile.summary && (
                    <div style={{ color: C.text, marginBottom: 10, fontStyle: "italic" }}>{profile.summary}</div>
                  )}
                  {profile.consistent && profile.consistent.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ color: C.gold, fontSize: 11, letterSpacing: 1 }}>일관된 취향</span>
                      {profile.consistent.map((c, i) => (
                        <div key={i} style={{ color: C.text, marginTop: 3 }}>· {c}</div>
                      ))}
                    </div>
                  )}
                  {profile.inconsistent && profile.inconsistent.length > 0 && (
                    <div>
                      <span style={{ color: C.goldDim, fontSize: 11, letterSpacing: 1 }}>아직 들쭉날쭉한 부분</span>
                      {profile.inconsistent.map((c, i) => (
                        <div key={i} style={{ color: C.sub, marginTop: 3 }}>· {c}</div>
                      ))}
                    </div>
                  )}
                  {/* 무엇을 중요하게 보는지: 중요도 막대 */}
                  {(profile.importanceWine || profile.importanceWhisky) && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
                      <span style={{ color: C.gold, fontSize: 11, letterSpacing: 1 }}>무엇을 중요하게 보는지</span>
                      {profile.importanceWine && Object.keys(profile.importanceWine).length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 11, color: C.wine, marginBottom: 4 }}>● 와인</div>
                          <AxisBars axes={profile.importanceWine} />
                        </div>
                      )}
                      {profile.importanceWhisky && Object.keys(profile.importanceWhisky).length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ fontSize: 11, color: C.whisky, marginBottom: 4 }}>● 위스키</div>
                          <AxisBars axes={profile.importanceWhisky} />
                        </div>
                      )}
                      {profile.importanceNote && (
                        <div style={{ fontSize: 12, color: C.sub, marginTop: 8, lineHeight: 1.5 }}>
                          {profile.importanceNote}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && tab === "recommend" && (
              <div style={{ color: C.gold, fontSize: 13, marginBottom: 10, textAlign: "center" }}>
                {error}
              </div>
            )}
            {recs && recs.length === 0 && (
              <div style={{ color: C.sub, textAlign: "center" }}>추천을 불러오지 못했어요.</div>
            )}
            {recs && recs.map((r, i) => {
              const d = recDetail[r.name];
              const loading = recDetailLoading === r.name;
              const open = d && d._open;
              return (
              <div key={i} style={{ background: C.panel,
                border: `1px solid ${open ? C.goldDim : C.line}`,
                borderRadius: 14, padding: 16, marginBottom: 10 }}>
                <div onClick={() => loadRecDetail(r.name, r.kind)} style={{ cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%",
                        background: r.kind === "whisky" ? C.whisky : C.wine }} />
                      <span style={{ fontSize: 10, color: C.sub, letterSpacing: 1 }}>
                        {r.kind === "whisky" ? "WHISKY" : "WINE"}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: C.goldDim }}>
                      {loading ? "불러오는 중…" : open ? "접기 ▲" : "자세히 ▼"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
                    {(r.predictedScore != null) && (
                      <div style={{ flexShrink: 0, width: 38, height: 38, borderRadius: "50%",
                        border: `2px solid ${C.gold}`, display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 13, fontWeight: 700, color: C.gold }}>
                        {r.predictedScore}
                      </div>
                    )}
                    <div style={{ fontFamily: "Georgia, serif", fontSize: 17 }}>
                      {r.name}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{r.why}</div>
                  {r.predictedScore != null && (
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>예측 점수는 추정값입니다</div>
                  )}
                  <div style={{ fontSize: 12, color: C.goldDim, marginTop: 6 }}>{r.est}</div>
                </div>

                {open && d && !d.error && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}`,
                    fontSize: 13, lineHeight: 1.6 }}>
                    {d.profile && (<div style={{ marginBottom: 8 }}>
                      <span style={{ color: C.gold, fontSize: 11, letterSpacing: 1 }}>프로파일</span>
                      <div style={{ color: C.text, marginTop: 2 }}>{d.profile}</div></div>)}
                    {d.forYou && (<div style={{ marginBottom: 8 }}>
                      <span style={{ color: C.gold, fontSize: 11, letterSpacing: 1 }}>당신에게</span>
                      <div style={{ color: C.text, marginTop: 2 }}>{d.forYou}</div></div>)}
                    {d.pairing && (<div style={{ marginBottom: 8 }}>
                      <span style={{ color: C.gold, fontSize: 11, letterSpacing: 1 }}>페어링</span>
                      <div style={{ color: C.text, marginTop: 2 }}>{d.pairing}</div></div>)}
                    {d.serving && (<div style={{ marginBottom: 8 }}>
                      <span style={{ color: C.gold, fontSize: 11, letterSpacing: 1 }}>서빙 팁</span>
                      <div style={{ color: C.text, marginTop: 2 }}>{d.serving}</div></div>)}
                    {d.axes && (
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ color: C.gold, fontSize: 11, letterSpacing: 1 }}>특성</span>
                        <AxisBars axes={d.axes} />
                      </div>
                    )}
                    {d.est && <div style={{ color: C.goldDim, fontSize: 12 }}>{d.est}</div>}

                    {/* 액션: 먹어봤으면 평가 / 안 먹어봤으면 위시리스트 */}
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
                      <div style={{ fontSize: 11, color: C.goldDim, marginBottom: 7 }}>
                        마셔봤다면 평가, 아니면 위시리스트에 담기
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <ScoreInput onSubmit={(s) => saveFromRec(r, s, "tasted")} />
                      </div>
                      <button onClick={() => saveFromRec(r, null, "wishlist")}
                        style={{ width: "100%", padding: "10px", background: "transparent",
                          color: C.gold, border: `1px solid ${C.goldDim}`, borderRadius: 8,
                          fontSize: 13, cursor: "pointer" }}>
                        ✧ 위시리스트에 추가
                      </button>
                    </div>
                  </div>
                )}
                {open && d && d.error && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "#D98" }}>
                    상세를 불러오지 못했어요. 다시 탭해 주세요.
                  </div>
                )}
              </div>
              );
            })}
            {recs && recs.length > 0 && (
              <button onClick={loadMoreRecs} disabled={recMoreLoading}
                style={{ width: "100%", padding: "12px", marginTop: 4, marginBottom: 20,
                  background: "transparent", color: C.gold, border: `1px dashed ${C.goldDim}`,
                  borderRadius: 10, fontSize: 13, cursor: "pointer", opacity: recMoreLoading ? 0.6 : 1 }}>
                {recMoreLoading ? "더 고르는 중…" : "↓ 더 추천받기"}
              </button>
            )}
          </section>
        )}

        {tab === "worldcup" && (
          <section>
            {/* 우승 결과 화면 */}
            {wcChampion ? (
              <div style={{ textAlign: "center", paddingTop: 20 }}>
                <div style={{ fontSize: 12, letterSpacing: 3, color: C.goldDim }}>WINNER</div>
                <div style={{ fontSize: 44, margin: "10px 0" }}>♛</div>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 24, color: C.gold }}>
                  {wcChampion.name}
                </div>
                {wcChampion.why && (
                  <div style={{ fontSize: 13, color: C.sub, marginTop: 8, lineHeight: 1.5,
                    maxWidth: 360, marginLeft: "auto", marginRight: "auto" }}>{wcChampion.why}</div>
                )}
                {wcRunnerUp && (
                  <div style={{ fontSize: 12, color: C.sub, marginTop: 16 }}>
                    준우승 · {wcRunnerUp.name}
                  </div>
                )}
                {!wcChampion.fromCellar && (
                  <div style={{ fontSize: 12, color: C.goldDim, marginTop: 8 }}>
                    위시리스트에 담았어요
                  </div>
                )}
                <button onClick={resetWorldcup}
                  style={{ marginTop: 24, padding: "12px 24px", background: C.gold, color: "#1B160C",
                    border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  다시 하기
                </button>
              </div>
            ) : wcRound ? (
              /* 대결 화면 */
              (() => {
                const a = wcRound[wcPair * 2];
                const b = wcRound[wcPair * 2 + 1];
                const totalPairs = Math.floor(wcRound.length / 2);
                const roundName = wcRound.length >= 16 ? "16강" : wcRound.length >= 8 ? "8강"
                  : wcRound.length >= 4 ? "4강" : "결승";
                if (!b) { // 홀수 부전승 처리
                  setTimeout(() => pickWinner(a), 0);
                  return null;
                }
                return (
                  <div>
                    <div style={{ textAlign: "center", fontSize: 12, color: C.goldDim,
                      letterSpacing: 2, marginBottom: 4 }}>
                      {roundName} · {wcPair + 1} / {totalPairs}
                    </div>
                    <div style={{ textAlign: "center", fontSize: 11, color: C.sub, marginBottom: 20 }}>
                      더 끌리는 쪽을 고르세요
                    </div>
                    {[a, b].map((c, i) => (
                      <div key={i}>
                        <button onClick={() => pickWinner(c)}
                          style={{ width: "100%", padding: "22px 18px", marginBottom: i === 0 ? 0 : 0,
                            background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16,
                            cursor: "pointer", textAlign: "left", color: C.text }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%",
                              background: c.kind === "whisky" ? C.whisky : C.wine }} />
                            <span style={{ fontSize: 10, color: C.sub, letterSpacing: 1 }}>
                              {c.fromCellar ? "내 셀러" : "추천"}
                            </span>
                          </div>
                          <div style={{ fontFamily: "Georgia, serif", fontSize: 19, margin: "6px 0" }}>
                            {c.name}
                          </div>
                          {c.why && <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>{c.why}</div>}
                        </button>
                        {i === 0 && (
                          <div style={{ textAlign: "center", color: C.goldDim, fontSize: 12,
                            margin: "10px 0", fontStyle: "italic" }}>VS</div>
                        )}
                      </div>
                    ))}
                    <button onClick={resetWorldcup}
                      style={{ width: "100%", marginTop: 16, padding: "10px", background: "transparent",
                        color: C.sub, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12,
                        cursor: "pointer" }}>그만두기</button>
                  </div>
                );
              })()
            ) : (
              /* 설정 화면 */
              <div>
                <div style={{ fontSize: 11, color: C.goldDim, letterSpacing: 1, marginBottom: 8 }}>
                  카테고리
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
                  {[["champagne", "샴페인"], ["white", "화이트"], ["red", "레드"], ["whisky", "위스키"]].map(([k, label]) => {
                    const sel = wcCategory === k;
                    return (
                      <button key={k} onClick={() => setWcCategory(k)}
                        style={{ flex: "1 0 22%", padding: "12px 0", fontSize: 13,
                          background: sel ? C.gold : C.panel, color: sel ? "#1B160C" : C.sub,
                          border: `1px solid ${sel ? C.gold : C.line}`, borderRadius: 10,
                          cursor: "pointer", fontWeight: sel ? 700 : 400 }}>{label}</button>
                    );
                  })}
                </div>

                <div style={{ fontSize: 11, color: C.goldDim, letterSpacing: 1, marginBottom: 8 }}>
                  후보 구성
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
                  {[["cellar", "셀러만"], ["outside", "셀러밖"], ["mix", "혼합"]].map(([k, label]) => {
                    const sel = wcSource === k;
                    return (
                      <button key={k} onClick={() => setWcSource(k)}
                        style={{ flex: 1, padding: "10px 0", fontSize: 13,
                          background: sel ? C.gold : C.panel, color: sel ? "#1B160C" : C.sub,
                          border: `1px solid ${sel ? C.gold : C.line}`, borderRadius: 10,
                          cursor: "pointer", fontWeight: sel ? 700 : 400 }}>{label}</button>
                    );
                  })}
                </div>

                <div style={{ fontSize: 11, color: C.goldDim, letterSpacing: 1, marginBottom: 8 }}>
                  규모
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 22 }}>
                  {[4, 8, 16].map((n) => {
                    const sel = wcSize === n;
                    return (
                      <button key={n} onClick={() => setWcSize(n)}
                        style={{ flex: 1, padding: "10px 0", fontSize: 13,
                          background: sel ? C.gold : C.panel, color: sel ? "#1B160C" : C.sub,
                          border: `1px solid ${sel ? C.gold : C.line}`, borderRadius: 10,
                          cursor: "pointer", fontWeight: sel ? 700 : 400 }}>{n}강</button>
                    );
                  })}
                </div>

                <button onClick={startWorldcup} disabled={!wcCategory || wcLoading}
                  style={{ width: "100%", padding: 15, background: wcCategory ? C.gold : C.panel2,
                    color: wcCategory ? "#1B160C" : C.sub, border: "none", borderRadius: 12,
                    fontSize: 15, fontWeight: 700, cursor: wcCategory ? "pointer" : "default",
                    opacity: wcLoading ? 0.6 : 1 }}>
                  {wcLoading ? "후보 준비 중…" : "월드컵 시작"}
                </button>
                {error && (
                  <div style={{ color: C.gold, fontSize: 13, marginTop: 12, textAlign: "center" }}>{error}</div>
                )}
                <div style={{ fontSize: 12, color: C.sub, marginTop: 16, lineHeight: 1.6 }}>
                  둘 중 더 끌리는 술을 골라 토너먼트로 최애를 가립니다. 우승작이 셀러에 없으면
                  위시리스트에 담아둬요.
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* 저장 상태 토스트 */}
      {pendingDelete && (
        <div style={{ position: "fixed", left: "50%", bottom: 78, transform: "translateX(-50%)",
          zIndex: 51, background: C.panel2, color: C.text, border: `1px solid ${C.line}`,
          borderRadius: 20, padding: "9px 12px 9px 18px", fontSize: 13, display: "flex",
          alignItems: "center", gap: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.4)", whiteSpace: "nowrap" }}>
          <span>삭제됨</span>
          <button onClick={undoDelete}
            style={{ background: "none", border: "none", color: C.gold, fontWeight: 700,
              fontSize: 13, cursor: "pointer", padding: "2px 6px" }}>되돌리기</button>
        </div>
      )}
      {toast && !pendingDelete && (
        <div style={{ position: "fixed", left: "50%", bottom: 78, transform: "translateX(-50%)",
          zIndex: 50, background: toast.kind === "error" ? "#5A2530" : C.panel2,
          color: toast.kind === "error" ? "#F4B8C0" : (toast.kind === "done" ? C.gold : C.text),
          border: `1px solid ${toast.kind === "error" ? "#7C2A3A" : C.line}`,
          borderRadius: 20, padding: "9px 18px", fontSize: 13, display: "flex", alignItems: "center",
          gap: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.4)", whiteSpace: "nowrap" }}>
          {toast.kind === "loading" && (
            <span style={{ width: 12, height: 12, border: `2px solid ${C.goldDim}`,
              borderTopColor: C.gold, borderRadius: "50%", display: "inline-block",
              animation: "vd-spin 0.7s linear infinite" }} />
          )}
          {toast.kind === "done" && <span>✓</span>}
          {toast.msg}
        </div>
      )}
      <style>{`@keyframes vd-spin { to { transform: rotate(360deg); } }`}</style>

      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.panel,
        borderTop: `1px solid ${C.line}`, display: "flex", maxWidth: 560, margin: "0 auto" }}>
        {[["feed", "피드", "❖"], ["add", "분석", "✦"], ["cellar", "셀러", "▤"], ["recommend", "추천", "✧"], ["worldcup", "월드컵", "♛"]].map(
          ([id, label, icon]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ flex: 1, padding: "14px 0", background: "none", border: "none",
                color: tab === id ? C.gold : C.sub, fontSize: 12, cursor: "pointer",
                display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              {label}
            </button>
          )
        )}
      </nav>
    </div>
  );
}
