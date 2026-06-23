import { useState, useRef, useCallback, useEffect } from "react";

// ── Audio system — mixes with Spotify, never interrupts ──
function createAudio() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint:"interactive" });
    function playTone(f, d, g, type="sine") {
      const o = ctx.createOscillator(), gain = ctx.createGain();
      o.connect(gain); gain.connect(ctx.destination);
      o.type = type; o.frequency.setValueAtTime(f, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(g, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d);
      o.start(ctx.currentTime); o.stop(ctx.currentTime + d);
    }
    return {
      resume: () => { if (ctx.state === "suspended") ctx.resume(); },
      flip: () => { playTone(480,0.08,0.06); setTimeout(()=>playTone(380,0.12,0.04),60); },
      swipe: () => {
        const o=ctx.createOscillator(), g=ctx.createGain(), f=ctx.createBiquadFilter();
        o.connect(f); f.connect(g); g.connect(ctx.destination);
        o.type="sawtooth"; f.type="bandpass";
        f.frequency.setValueAtTime(800,ctx.currentTime);
        f.frequency.exponentialRampToValueAtTime(200,ctx.currentTime+0.15);
        o.frequency.setValueAtTime(300,ctx.currentTime);
        g.gain.setValueAtTime(0.04,ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.15);
        o.start(ctx.currentTime); o.stop(ctx.currentTime+0.15);
      },
    };
  } catch(e) { return { resume:()=>{}, flip:()=>{}, swipe:()=>{} }; }
}
const audio = createAudio();

// ── localStorage memory helpers ──
const STORAGE_KEY = "gofirst_v1";
function loadMemory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { seen: [], totalPlayed: 0, activeCats: null, hasSeenTutorial: false };
    return JSON.parse(raw);
  } catch { return { seen: [], totalPlayed: 0, activeCats: null, hasSeenTutorial: false }; }
}
function saveMemory(mem) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(mem)); } catch {}
}

const FREE_QUESTIONS = [
  "What did you assume about me that turned out to be completely wrong?",
  "What's a moment that quietly changed you?",
  "What do you think my biggest blind spot is?",
  "What's something you've never felt fully understood about?",
  "What's your most controversial food opinion?",
  "What do you hope love feels like years from now?",
  "Tell me about a time you stood up for something and it cost you.",
  "What version of yourself comes out in relationships?",
  "What would your villain origin story be?",
  "What are you still healing from?",
];

const CATEGORY_ORDER = ["Starter","Playful & Funny","Story Questions","Attraction & Chemistry","Honest Impressions","Life & Values","Emotional Intimacy","Late Night"];

const CATEGORIES = {
  "Starter":              { pillBg:"#D4C4B0", pillText:"#3C2410", cardBg:"#F5EDE0", cardBorder:"#E8DDD0", accent:"#3C2410", emoji:"🎯", questions: FREE_QUESTIONS },
  "Playful & Funny":      { pillBg:"#C4A882", pillText:"#3C2410", cardBg:"#F5EDE0", cardBorder:"#E8DDD0", accent:"#3C2410", emoji:"😄", questions:["What's the dumbest injury you've ever had?","What's your most irrational fear?","What's something you were convinced of as a kid that was completely wrong?","What's your most controversial food opinion?","What's your most useless talent?","What's your weirdest habit when nobody is watching?","What's a hill you'll die on for absolutely no reason?","If your life had a warning label, what would it say?","What's a film or show you're embarrassed to admit you love?","What's the worst advice you've ever confidently given someone?","What's a phrase or word you say too much?","What would your villain origin story be?","What's the most chaotic decision you've ever made on a whim?","What's something you owned as a kid that you'd be mortified by now?","What's a completely unhinged rule you have for yourself?","If your pet had to describe you to a stranger, what would they say?","What's a completely made-up skill you've pretended to have?","What's the most ridiculous thing you've ever argued about?"] },
  "Story Questions":      { pillBg:"#B8956A", pillText:"#3C2410", cardBg:"#F5EDE0", cardBorder:"#E8DDD0", accent:"#3C2410", emoji:"📖", questions:["Tell me about one of the best days of your life.","Tell me about a moment you laughed so hard you couldn't breathe.","What's a memory you wish you could relive for one hour?","Tell me about a time everything went spectacularly wrong.","What's a random memory you think about more than you should?","What's a moment that quietly changed you?","What's a tiny childhood memory you still remember vividly?","Tell me about a time you felt deeply proud of yourself.","What's a memory that still makes you emotional?","Tell me about a moment you felt truly free.","Tell me about a stranger who made a surprising impact on you.","What's a decision you made that turned out way better than expected?","Tell me about a time you surprised yourself.","Tell me about a time you stood up for something and it cost you.","What's a moment where you realised you'd changed?","Tell me about the last time you were genuinely moved by something.","What's a mistake you'd actually make again?","Tell me about a friendship that shaped who you are."] },
  "Attraction & Chemistry":{ pillBg:"#A67D55", pillText:"#F5EDD9", cardBg:"#F5EDE0", cardBorder:"#E8DDD0", accent:"#3C2410", emoji:"✨", questions:["What's something non-sexual you find incredibly attractive?","When did you first realise you were attracted to me?","What kind of touch comes naturally to you?","What kind of affection makes you melt?","What's your ideal slow Sunday together?","What kind of moments make you want to kiss someone?","What creates chemistry for you beyond physical attraction?","What's your favourite thing about early dating?","What's something subtle someone can do that drives you wild?","What kind of intimacy matters most to you?","What's something about how someone carries themselves that draws you in?","What's a quality in someone that sneaks up on you over time?","What do you notice about someone before you notice anything else?","What makes you feel truly seen by another person?","What kind of conversation gives you that electric feeling?","What does flirting look like to you when it's done well?","What makes you feel genuinely confident around someone?","What's something you find attractive that you've never really told anyone?"] },
  "Honest Impressions":   { pillBg:"#8B6445", pillText:"#F5EDD9", cardBg:"#F5EDE0", cardBorder:"#E8DDD0", accent:"#3C2410", emoji:"🪞", questions:["What did you assume about me that turned out to be completely wrong?","What did you think I was like before you actually knew me?","What's something about me you still haven't figured out?","What do you think I need more of in my life?","What's something you've noticed about me that I probably don't see in myself?","What do you think my biggest blind spot is?","What's something you think we have in common that might surprise me?","What's something you want me to know about you that I might have wrong?","What's the version of you that most people don't get to see?","What do people assume about you based on how you look or come across?","What's something you do that people misread?","What's something about me you were initially unsure about?","What's a question you've wanted to ask me but haven't yet?","What's your honest first impression of me, now that it's safe to say?","What's something you think I'm better at than I give myself credit for?","What do you think I'm like when things get hard?"] },
  "Life & Values":        { pillBg:"#52371E", pillText:"#F5EDD9", cardBg:"#F5EDE0", cardBorder:"#E8DDD0", accent:"#3C2410", emoji:"🧭", questions:["What matters most to you in life now?","What kind of life are you trying to build?","What does commitment mean to you?","What kind of partner do you want to be?","What does a really good ordinary life look like to you?","What are your non-negotiables in relationships?","What kind of home environment makes you happiest?","What do you think makes relationships last?","What scares you most about relationships?","What kind of future feels exciting to you?","What's something you used to want that you no longer care about?","What's a value you hold that most people in your life don't share?","What does success look like to you right now, honestly?","What would you do differently if you weren't worried about what people thought?","What chapter of your life are you in right now?","What's something you hope you never compromise on?","Who has shaped your idea of what love should look like?","What kind of person do you want to have become in ten years?"] },
  "Emotional Intimacy":   { pillBg:"#6B4A30", pillText:"#F5EDD9", cardBg:"#F5EDE0", cardBorder:"#E8DDD0", accent:"#3C2410", emoji:"🌿", questions:["When do you feel most emotionally safe?","What makes somewhere feel like home to you?","What helps you feel calm when life is overwhelming?","What makes you shut down emotionally?","What kind of people make you feel safe?","What's something you wish more people understood about you?","What do you need most when you're stressed?","What makes you feel deeply loved?","What kind of relationship dynamic feels healthiest to you?","What's something you protect fiercely in your life?","What do you do when you need to process something hard?","How do you know when you actually trust someone?","What does it look like when you're at your worst, and what do you need then?","What's something you've had to unlearn about how to love people?","What's a boundary you've set that changed your life?","What's something you've forgiven someone for that took a long time?","What do you wish you were better at emotionally?","What's a version of yourself you've had to leave behind?"] },
  "Late Night":           { pillBg:"#3C2410", pillText:"#F5EDD9", cardBg:"#F5EDE0", cardBorder:"#E8DDD0", accent:"#3C2410", emoji:"🌙", questions:["What do you think love should feel like?","What part of yourself do you struggle to show people?","What kind of relationship do you never want to repeat?","When do you feel most connected to someone?","What are you still healing from?","What does emotional loyalty mean to you?","What kind of relationship would make life feel softer?","What's something you've never felt fully understood about?","What version of yourself comes out in relationships?","What do you hope love feels like years from now?"] },
};

// ── Relationship types ──
const RELATIONSHIP_TYPES = [
  {
    id: "friends",
    label: "Friends",
    emoji: "👥",
    description: "Deepen a friendship",
    cats: ["Starter","Playful & Funny","Story Questions","Honest Impressions","Life & Values"],
    showToggle: false,
  },
  {
    id: "dating",
    label: "Getting to Know You",
    emoji: "💫",
    description: "Early dating",
    cats: ["Starter","Playful & Funny","Attraction & Chemistry","Honest Impressions","Story Questions"],
    showToggle: false,
  },
  {
    id: "together",
    label: "We're a Thing",
    emoji: "❤️",
    description: "In a relationship",
    cats: ["Attraction & Chemistry","Honest Impressions","Emotional Intimacy","Life & Values","Story Questions"],
    showToggle: true,
  },
  {
    id: "married",
    label: "It's Us",
    emoji: "💍",
    description: "Long term or married",
    cats: ["Emotional Intimacy","Life & Values","Late Night","Honest Impressions","Attraction & Chemistry"],
    showToggle: true,
  },
];

// Convert a question from "about me" to "about you" perspective
function flipQuestion(q) {
  return q
    .replace(/do you find/gi, "do I find")
    .replace(/do you/gi, "do I")
    .replace(/you find/gi, "I find")
    .replace(/you feel/gi, "I feel")
    .replace(/you need/gi, "I need")
    .replace(/you want/gi, "I want")
    .replace(/you think/gi, "I think")
    .replace(/you wish/gi, "I wish")
    .replace(/you love/gi, "I love")
    .replace(/you most/gi, "I most")
    .replace(/you still/gi, "I still")
    .replace(/you hope/gi, "I hope")
    .replace(/your/gi, "my")
    .replace(/Your/g, "My")
    .replace(/you/gi, "I")
    .replace(/You/g, "I")
    // Fix double "I I" artifacts
    .replace(/I I/g, "I")
    // Fix question endings
    .replace(/do I\?/g, "do you?")
    .trim();
}

const TUTORIAL_STEPS = [
  { title:"Welcome to Go First", body:"A card game for people brave enough to say the things typically left unsaid.", dare:null },
  { title:"Tap to reveal", body:"Each card starts face down. When you're ready, tap it to flip and reveal the question.", dare:null },
  { title:"Answer honestly", body:"Take turns answering. There are no right answers\u2026just yours.", dare:null },
  { title:"Swipe to move on", body:"When you\u2019re done, swipe left to reveal the next card.", dare:null },
  { title:"Change it up", body:"Turn the categories on or off at any time to change the emotional pace or lighten the mood.", dare:"Who will Go First?" },
];

const CARD_BACK_SRC = "data:image/jpeg;base64,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";
function CardBack() {
  return (
    <div style={{ width:"100%", height:"100%", borderRadius:18, overflow:"hidden", boxShadow:"0 8px 40px rgba(74,40,16,0.25)" }}>
      <img src={{CARD_BACK_SRC}} alt="" draggable="false" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"center", display:"block" }} />
    </div>
  );
}

function TutIcon({ step }) {
  const p = { stroke:"#7A4A24", strokeWidth:"1.5", strokeLinecap:"round", strokeLinejoin:"round", fill:"none" };
  if (step===0) return <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="6" y="8" width="24" height="30" rx="3" {...p}/><rect x="12" y="4" width="24" height="30" rx="3" {...p}/><line x1="18" y1="17" x2="28" y2="17" {...p}/><line x1="18" y1="22" x2="24" y2="22" {...p}/></svg>;
  if (step===1) return <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="10" y="4" width="24" height="32" rx="3" {...p}/><path d="M22 14 L22 24 M17 20 L22 25 L27 20" {...p}/></svg>;
  if (step===2) return <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><path d="M6 10 Q6 6 10 6 L34 6 Q38 6 38 10 L38 24 Q38 28 34 28 L24 28 L16 36 L16 28 L10 28 Q6 28 6 24 Z" {...p}/><line x1="13" y1="15" x2="31" y2="15" {...p}/><line x1="13" y1="20" x2="24" y2="20" {...p}/></svg>;
  if (step===3) return <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="12" y="6" width="20" height="28" rx="3" {...p}/><path d="M8 20 L2 20 M6 16 L2 20 L6 24" {...p}/></svg>;
  if (step===4) return <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="4" y="8" width="16" height="10" rx="5" {...p}/><circle cx="15" cy="13" r="3" {...p}/><rect x="24" y="8" width="16" height="10" rx="5" {...p}/><circle cx="29" cy="13" r="3" {...p}/><rect x="4" y="26" width="16" height="10" rx="5" {...p}/><circle cx="15" cy="31" r="3" {...p}/><rect x="24" y="26" width="16" height="10" rx="5" {...p}/><circle cx="35" cy="31" r="3" {...p}/></svg>;
  return null;
}

function buildPool(activeCats) {
  let pool = [];
  activeCats.forEach(cat => {
    const data = CATEGORIES[cat];
    if (data) pool = [...pool, ...data.questions.map(q => ({ question:q, category:cat }))];
  });
  return pool;
}

// Pick next unseen question — never repeats until all seen, then resets
function pickNextUnseen(pool, seenSet, excludeQ) {
  const unseen = pool.filter(q => !seenSet.has(q.question) && q.question !== excludeQ);
  if (unseen.length > 0) {
    return unseen[Math.floor(Math.random() * unseen.length)];
  }
  // All seen — pick any except current
  const fallback = pool.filter(q => q.question !== excludeQ);
  return fallback.length > 0 ? fallback[Math.floor(Math.random() * fallback.length)] : pool[0];
}

export default function App() {
  const mem = loadMemory();

  const [screen, setScreen] = useState("home");
  const [tutStep, setTutStep] = useState(0);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(mem.hasSeenTutorial || false);
  const [activeCats, setActiveCats] = useState(mem.activeCats || [...CATEGORY_ORDER]);
  const [relationshipType, setRelationshipType] = useState(null);
  const [perspectiveFlipped, setPerspectiveFlipped] = useState(false);
  const [seenQuestions, setSeenQuestions] = useState(new Set(mem.seen || []));
  const [totalPlayed, setTotalPlayed] = useState(mem.totalPlayed || 0);
  const [flipped, setFlipped] = useState(false);
  const [current, setCurrent] = useState(null);
  const [nextCard, setNextCard] = useState(null);
  const [count, setCount] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [gone, setGone] = useState(false);
  const [deckExhausted, setDeckExhausted] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const dragStartX = useRef(null);
  const hasDragged = useRef(false);

  // Persist memory whenever key state changes
  useEffect(() => {
    saveMemory({
      seen: [...seenQuestions],
      totalPlayed,
      activeCats,
      hasSeenTutorial,
    });
  }, [seenQuestions, totalPlayed, activeCats, hasSeenTutorial]);

  const pool = buildPool(activeCats);
  const showPerspectiveToggle = relationshipType ? (RELATIONSHIP_TYPES.find(r => r.id === relationshipType)?.showToggle || false) : false;
  const displayQuestion = current ? (perspectiveFlipped ? flipQuestion(current.question) : current.question) : "";
  const catData = current ? CATEGORIES[current.category] : null;
  const accent = "#3C2410";
  const cardBg = catData?.cardBg || "#F5EDE0";
  const cardBorder = catData?.cardBorder || "#E8DDD0";

  const markSeen = useCallback((question) => {
    setSeenQuestions(prev => {
      const next = new Set(prev);
      next.add(question);
      return next;
    });
    setTotalPlayed(t => t + 1);
  }, []);

  const initPlay = useCallback((cats) => {
    const usedCats = cats || activeCats;
    const p = buildPool(usedCats);
    if (!p.length) return;
    const first = pickNextUnseen(p, seenQuestions, "");
    const second = pickNextUnseen(p, seenQuestions, first?.question || "");
    setCurrent(first);
    setNextCard(second);
    setFlipped(false); setCount(1);
    setDragX(0); setGone(false); setIsDragging(false);
    setDeckExhausted(false);
    setScreen("play");
  }, [activeCats, seenQuestions]);

  const advance = useCallback(() => {
    if (!nextCard) return;
    // Mark current as seen
    if (current) markSeen(current.question);
    const p = buildPool(activeCats);
    const newSeen = new Set(seenQuestions);
    if (current) newSeen.add(current.question);
    // Check if all questions have been seen
    const allSeen = p.every(q => newSeen.has(q.question));
    if (allSeen) {
      setCurrent(nextCard);
      setNextCard(null);
      setFlipped(false);
      setCount(c => c + 1);
      setDragX(0); setGone(false); setIsDragging(false);
      hasDragged.current = false;
      setDeckExhausted(true);
      return;
    }
    const upcoming = pickNextUnseen(p, newSeen, nextCard.question);
    setCurrent(nextCard);
    setNextCard(upcoming);
    setFlipped(false); setCount(c => c + 1);
    setDragX(0); setGone(false); setIsDragging(false);
    hasDragged.current = false;
    setPerspectiveFlipped(false);
  }, [nextCard, current, activeCats, seenQuestions, markSeen]);

  const handleReset = () => {
    setSeenQuestions(new Set());
    setTotalPlayed(0);
    setShowReset(false);
    setDeckExhausted(false);
    initPlay();
  };

  const handleCardTap = () => {
    if (!flipped && !hasDragged.current) {
      audio.resume(); audio.flip(); setFlipped(true);
    }
  };

  const onPointerDown = (e) => {
    if (!flipped) return;
    dragStartX.current = e.touches ? e.touches[0].clientX : e.clientX;
    hasDragged.current = false; setIsDragging(true);
  };
  const onPointerMove = (e) => {
    if (!isDragging || dragStartX.current === null) return;
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - dragStartX.current;
    if (Math.abs(x) > 4) hasDragged.current = true;
    setDragX(x);
  };
  const onPointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragX < -80) { audio.resume(); audio.swipe(); setGone(true); setTimeout(advance, 300); }
    else { setDragX(0); setTimeout(() => { hasDragged.current = false; }, 50); }
    dragStartX.current = null;
  };

  const toggleCat = (cat) => {
    setActiveCats(prev => {
      if (prev.includes(cat)) { if (prev.length <= 1) return prev; return prev.filter(c => c !== cat); }
      return [...prev, cat];
    });
  };

  const unseenCount = pool.filter(q => !seenQuestions.has(q.question)).length;

  return (
    <div style={{ minHeight:"100vh", background:"#F0EAE0", display:"flex", flexDirection:"column", alignItems:"center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        html,body { overscroll-behavior:none; overflow:hidden; height:100%; background:#F0EAE0; -webkit-text-size-adjust:100%; }
        body { padding-top:env(safe-area-inset-top); padding-bottom:env(safe-area-inset-bottom); }
        #root { height:100%; overflow-y:auto; overscroll-behavior:none; -webkit-overflow-scrolling:touch; }
        * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; -webkit-touch-callout:none; user-select:none; }
        .btn-primary { background:#5C3418; color:#F5EDD9; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; font-size:12px; font-weight:500; letter-spacing:0.14em; text-transform:uppercase; padding:16px 48px; border-radius:100px; transition:all 0.2s; }
        .btn-primary:hover { background:#7A4A24; }
        .btn-primary:disabled { opacity:0.35; cursor:default; }
        .btn-back { background:none; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; font-size:11px; color:#A08868; letter-spacing:0.1em; text-transform:uppercase; padding:0; }
        .btn-ghost { background:none; border:1.5px solid #C4A882; color:#8B6445; cursor:pointer; font-family:'DM Sans',sans-serif; font-size:11px; font-weight:500; letter-spacing:0.12em; text-transform:uppercase; padding:12px 32px; border-radius:100px; transition:all 0.2s; }
        .pill { border:1.5px solid; border-radius:100px; padding:6px 13px; cursor:pointer; font-family:'DM Sans',sans-serif; font-size:11px; white-space:nowrap; transition:all 0.2s; background:transparent; display:inline-flex; align-items:center; gap:5px; }
        .tut-dot { height:6px; border-radius:3px; transition:all 0.3s; }
      `}</style>

      {/* ── HOME ── */}
      {screen === "home" && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"0 24px 60px", width:"100%", maxWidth:460 }}>
          <div style={{ textAlign:"center", paddingTop:64, paddingBottom:40 }}>
            <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, letterSpacing:"0.22em", textTransform:"uppercase", color:"#A08868", marginBottom:12 }}>Say the things we leave unsaid</p>
            <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:52, fontWeight:400, color:"#3C2010", fontStyle:"italic", lineHeight:1 }}>Go First</h1>
            <div style={{ width:32, height:1, background:"#C4905A", margin:"16px auto 0" }} />
          </div>
          <div style={{ position:"relative", width:240, height:210, marginBottom:48 }}>
            {[{rot:"-7deg",top:28,left:8,op:0.4,s:0.62},{rot:"4deg",top:14,left:20,op:0.65,s:0.64},{rot:"-1deg",top:0,left:14,op:1,s:0.66}].map((c,i) => (
              <div key={i} style={{ position:"absolute", top:c.top, left:c.left, width:220, height:308, transform:`rotate(${c.rot}) scale(${c.s})`, transformOrigin:"top center", opacity:c.op }}>
                <CardBack />
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={() => setScreen("deck")}>Build your deck</button>
          <p style={{ marginTop:14, fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#C0A888", letterSpacing:"0.06em" }}>Choose your categories, then play</p>
          {totalPlayed > 0 && (
            <p style={{ marginTop:10, fontFamily:"'DM Sans',sans-serif", fontSize:10, color:"#C8B8A0", letterSpacing:"0.04em" }}>
              {totalPlayed} question{totalPlayed !== 1 ? "s" : ""} asked so far
            </p>
          )}
        </div>
      )}

      {/* ── TUTORIAL ── */}
      {screen === "tutorial" && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", padding:"24px 28px", width:"100%", maxWidth:420 }}>
          <div style={{ background:"#FBF5EC", border:"1.5px solid #DDD0BC", borderRadius:20, padding:"44px 32px", width:"100%", textAlign:"center", boxShadow:"0 8px 40px rgba(74,40,16,0.10)" }}>
            <div style={{ marginBottom:24, display:"flex", justifyContent:"center" }}><TutIcon step={tutStep} /></div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontStyle:"italic", color:"#3C2010", marginBottom:14, lineHeight:1.3 }}>{TUTORIAL_STEPS[tutStep].title}</h2>
            <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, color:"#7A5840", lineHeight:1.75, marginBottom:TUTORIAL_STEPS[tutStep].dare ? 16 : 32 }}>{TUTORIAL_STEPS[tutStep].body}</p>
            {TUTORIAL_STEPS[tutStep].dare && (
              <p style={{ fontFamily:"'Playfair Display',serif", fontStyle:"italic", fontSize:20, color:"#3C2010", marginBottom:32 }}>{TUTORIAL_STEPS[tutStep].dare}</p>
            )}
            <div style={{ display:"flex", gap:6, justifyContent:"center", marginBottom:28 }}>
              {TUTORIAL_STEPS.map((_,i) => {
                const stepColors = ["#D4C4B0","#C4A882","#B8956A","#8B6445","#3C2410"];
                return <div key={i} className="tut-dot" style={{ width:i===tutStep?20:6, background:i<=tutStep?stepColors[i]:"#E8DDD0" }} />;
              })}
            </div>
            <button className="btn-primary" style={{ width:"100%", background:["#D4C4B0","#C4A882","#B8956A","#8B6445","#3C2410"][tutStep], color:tutStep<2?"#3C2410":"#F5EDD9" }} onClick={() => {
              if (tutStep < TUTORIAL_STEPS.length-1) setTutStep(t=>t+1);
              else { setHasSeenTutorial(true); initPlay(); }
            }}>{tutStep < TUTORIAL_STEPS.length-1 ? "Next →" : "Begin"}</button>
            {tutStep > 0 && <button onClick={() => setTutStep(t=>t-1)} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#B8A888", marginTop:14, display:"block", width:"100%" }}>← Back</button>}
          </div>
        </div>
      )}

      {/* ── DECK BUILDER ── */}
      {screen === "deck" && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"0 20px 80px", width:"100%", maxWidth:460 }}>
          <div style={{ width:"100%", paddingTop:40, paddingBottom:24, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <button className="btn-back" onClick={() => setScreen("home")}>← Back</button>
            <p style={{ fontFamily:"'Playfair Display',serif", fontStyle:"italic", fontSize:20, color:"#3C2010" }}>Go First</p>
            <div style={{ width:48 }} />
          </div>

          {/* Relationship selector */}
          <p style={{ fontFamily:"'Playfair Display',serif", fontStyle:"italic", fontSize:22, color:"#3C2010", textAlign:"center", marginBottom:8, lineHeight:1.4 }}>Who are you playing with?</p>
          <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:"#A08868", textAlign:"center", marginBottom:24 }}>We'll suggest the right questions</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:10, justifyContent:"center", marginBottom:32, width:"100%" }}>
            {RELATIONSHIP_TYPES.map(rel => {
              const isActive = relationshipType === rel.id;
              return (
                <button key={rel.id} onClick={() => {
                  setRelationshipType(rel.id);
                  setActiveCats(rel.cats);
                }} style={{
                  background: isActive ? "#3C2010" : "#FBF5EC",
                  border: `1.5px solid ${isActive ? "#3C2010" : "#DDD0BC"}`,
                  borderRadius: 14, padding:"14px 18px", cursor:"pointer",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:6,
                  transition:"all 0.2s", minWidth:90,
                }}>
                  <span style={{ fontSize:22 }}>{rel.emoji}</span>
                  <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:500, color: isActive ? "#F5EDD9" : "#3C2010", letterSpacing:"0.04em" }}>{rel.label}</p>
                  <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color: isActive ? "#C4A882" : "#A08868", letterSpacing:"0.03em" }}>{rel.description}</p>
                </button>
              );
            })}
          </div>

          <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#A08868", textAlign:"center", marginBottom:16, letterSpacing:"0.04em" }}>
            {relationshipType ? "Fine tune your deck" : "Or choose categories manually"}
          </p>
          <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:"#C0A888", textAlign:"center", marginBottom:20 }}>Lighter → heavier</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:10, justifyContent:"center", marginBottom:40 }}>
            {CATEGORY_ORDER.map(cat => {
              const d = CATEGORIES[cat]; if (!d) return null;
              const isOn = activeCats.includes(cat);
              return (
                <button key={cat} className="pill" style={{ borderColor:d.pillBg, color:isOn?d.pillText:"#7A6050", background:isOn?d.pillBg:"transparent", opacity:isOn?1:0.65 }} onClick={() => toggleCat(cat)}>
                  <span>{d.emoji}</span><span>{cat}</span>
                </button>
              );
            })}
          </div>
          <div style={{ width:"100%", background:"#FBF5EC", border:"1px solid #DDD0BC", borderRadius:16, padding:"18px 22px", marginBottom:12, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <p style={{ fontFamily:"'Playfair Display',serif", fontStyle:"italic", fontSize:16, color:"#3C2010", marginBottom:4 }}>Your deck</p>
              <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:"#A08868" }}>
                {unseenCount} unseen · {pool.length} total
              </p>
            </div>
            <div style={{ display:"flex" }}>
              {activeCats.slice(0,4).map((cat,i) => <div key={cat} style={{ width:26, height:34, borderRadius:4, background:CATEGORIES[cat]?.pillBg||"#8B6445", border:"2px solid #F0EAE0", marginLeft:i>0?-8:0 }} />)}
              {activeCats.length > 4 && <div style={{ width:26, height:34, borderRadius:4, background:"#C0A888", border:"2px solid #F0EAE0", marginLeft:-8, display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:9, color:"white", fontFamily:"'DM Sans',sans-serif", fontWeight:500 }}>+{activeCats.length-4}</span></div>}
            </div>
          </div>
          {/* Reset option */}
          {seenQuestions.size > 0 && (
            <button className="btn-ghost" style={{ marginBottom:24 }} onClick={() => setShowReset(true)}>
              Reset progress · {seenQuestions.size} seen
            </button>
          )}
          <button className="btn-primary" disabled={pool.length===0} onClick={() => { if (!hasSeenTutorial) { setTutStep(0); setScreen("tutorial"); } else { initPlay(); } }}>
            Play · {unseenCount} new questions
          </button>
        </div>
      )}

      {/* ── RESET CONFIRMATION ── */}
      {showReset && (
        <div style={{ position:"fixed", inset:0, background:"rgba(44,35,24,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:24 }}>
          <div style={{ background:"#FBF5EC", borderRadius:20, padding:"40px 32px", width:"100%", maxWidth:340, textAlign:"center" }}>
            <p style={{ fontFamily:"'Playfair Display',serif", fontStyle:"italic", fontSize:22, color:"#3C2010", marginBottom:12 }}>Start fresh?</p>
            <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#7A5840", lineHeight:1.7, marginBottom:28 }}>
              You've asked {seenQuestions.size} question{seenQuestions.size !== 1 ? "s" : ""}. Reset will let you experience them all again from the beginning.
            </p>
            <button className="btn-primary" style={{ width:"100%", marginBottom:12 }} onClick={handleReset}>Yes, start fresh</button>
            <button className="btn-ghost" style={{ width:"100%" }} onClick={() => setShowReset(false)}>Keep my progress</button>
          </div>
        </div>
      )}

      {/* ── PLAY ── */}
      {screen === "play" && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"0 12px 40px", width:"100%", maxWidth:460, minHeight:"100vh" }}>
          <div style={{ width:"100%", paddingTop:36, paddingBottom:16, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <button className="btn-back" onClick={() => setScreen("deck")}>← Decks</button>
            <p style={{ fontFamily:"'Playfair Display',serif", fontStyle:"italic", fontSize:18, color:"#3C2010" }}>Go First</p>
            <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:"#C0A888", letterSpacing:"0.08em", minWidth:40, textAlign:"right" }}>{count}</p>
          </div>

          {/* Category pills */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:7, justifyContent:"center", marginBottom:20, width:"100%" }}>
            {CATEGORY_ORDER.map(cat => {
              const d = CATEGORIES[cat]; if (!d) return null;
              const isOn = activeCats.includes(cat);
              return (
                <button key={cat} className="pill" style={{ fontSize:10, padding:"5px 11px", borderColor:d.pillBg, color:isOn?d.pillText:"#A08868", background:isOn?d.pillBg:"transparent", opacity:isOn?1:0.5 }} onClick={() => toggleCat(cat)}>
                  {d.emoji} {cat}
                </button>
              );
            })}
          </div>

          {/* Card stack */}
          <div style={{ position:"relative", width:"100%", maxWidth:360, height:504, marginBottom:20 }}>
            {nextCard && !deckExhausted && (
              <div style={{ position:"absolute", inset:0, transform:"scale(0.95) translateY(10px)", transformOrigin:"bottom center", opacity:1, pointerEvents:"none", zIndex:1 }}>
                <CardBack />
              </div>
            )}

            {/* Deck exhausted card */}
            {deckExhausted && (
              <div style={{ position:"absolute", inset:0, zIndex:2, background:"#F5EDE0", border:"1.5px solid #E8DDD0", borderRadius:18, padding:"40px 32px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", boxShadow:"0 8px 40px rgba(74,40,16,0.12)" }}>
                <div style={{ position:"absolute", inset:10, border:"1px solid rgba(180,160,140,0.25)", borderRadius:11, pointerEvents:"none" }} />
                <p style={{ fontFamily:"'Playfair Display',serif", fontStyle:"italic", fontSize:28, color:"#3C2010", lineHeight:1.4, marginBottom:16 }}>You've asked it all.</p>
                <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#A08868", lineHeight:1.7, marginBottom:32 }}>Every question in your deck has been asked. The conversations you've had are the ones worth having.</p>
                <button className="btn-ghost" onClick={() => setShowReset(true)}>Start fresh</button>
              </div>
            )}

            {/* Current card */}
            {current && !deckExhausted && (
              <div
                key={current.question}
                style={{ position:"absolute", inset:0, zIndex:2, opacity:1,
                  transform: gone ? "translateX(-110vw) rotate(-18deg)" : `translateX(${dragX}px) rotate(${dragX*0.025}deg)`,
                  transition: isDragging ? "none" : gone ? "transform 0.28s ease-in" : "transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)",
                  cursor: flipped ? "grab" : "pointer", touchAction:"pan-y",
                }}
                onClick={handleCardTap}
                onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp} onMouseLeave={onPointerUp}
                onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}
              >
                {/* Card back face */}
                <div style={{ position:"absolute", inset:0, opacity:flipped?0:1, transform:flipped?"scale(0.94)":"scale(1)", transition:isDragging?"none":"opacity 0.22s ease, transform 0.22s ease", pointerEvents:flipped?"none":"auto" }}>
                  <CardBack />
                </div>
                {/* Question face */}
                <div style={{ position:"absolute", inset:0, opacity:flipped?1:0, transform:flipped?"scale(1)":"scale(0.94)", transition:isDragging?"none":"opacity 0.22s ease 0.08s, transform 0.22s ease 0.08s",
                  background:cardBg, border:`1.5px solid ${cardBorder}`, borderRadius:18, padding:"34px 28px",
                  display:"flex", flexDirection:"column", justifyContent:"space-between",
                  boxShadow:"0 8px 40px rgba(74,40,16,0.12)", pointerEvents:flipped?"auto":"none" }}>
                  <div style={{ position:"absolute", inset:10, border:"1px solid rgba(180,160,140,0.25)", borderRadius:11, pointerEvents:"none" }} />
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:5, height:5, borderRadius:"50%", background:"#3C2410", flexShrink:0 }} />
                      <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, letterSpacing:"0.18em", textTransform:"uppercase", color:"#3C2410", opacity:0.6 }}>{current.category}</p>
                    </div>
                    {showPerspectiveToggle && (
                      <button onClick={(e) => { e.stopPropagation(); setPerspectiveFlipped(v => !v); }} style={{
                        background: perspectiveFlipped ? "#3C2410" : "transparent",
                        border: "1px solid #C4A882",
                        borderRadius: 100, padding:"3px 10px", cursor:"pointer",
                        display:"flex", alignItems:"center", gap:5, transition:"all 0.2s",
                      }}>
                        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, letterSpacing:"0.08em", color: perspectiveFlipped ? "#F5EDD9" : "#8B6445", fontWeight:500 }}>
                          {perspectiveFlipped ? "About you" : "About me"}
                        </span>
                      </button>
                    )}
                  </div>
                  <p style={{ fontFamily:"'Playfair Display',serif", fontSize:displayQuestion.length>90?19:displayQuestion.length>65?22:25, fontWeight:400, lineHeight:1.55, color:"#2C1808", fontStyle:"italic", flex:1, display:"flex", alignItems:"center", paddingTop:14 }}>
                    {displayQuestion}
                  </p>
                  <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"#3C2410", opacity:0.3, letterSpacing:"0.1em" }}>— {count}</p>
                </div>
              </div>
            )}
          </div>

          {/* Hint + progress */}
          <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#C0A888", letterSpacing:"0.06em", textAlign:"center", minHeight:18 }}>
            {deckExhausted ? "" : !flipped ? "Tap to reveal" : dragX < -40 ? "Let go to discard" : "Swipe left when you're done"}
          </p>
          <p style={{ marginTop:8, fontFamily:"'DM Sans',sans-serif", fontSize:10, color:"#D0C4B4", letterSpacing:"0.06em" }}>
            {unseenCount} unseen · {totalPlayed} played
          </p>
        </div>
      )}
    </div>
  );
}
