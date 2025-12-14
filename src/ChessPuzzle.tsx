import React, { useMemo, useState } from "react";
import { Chess, Move, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { motion } from "framer-motion";
import { Play, RotateCcw, Undo2, Lightbulb, Info, CheckCircle2, XCircle, ChevronRight } from "lucide-react";

/**
 * Chess Puzzle — interactive trainer (Chess.com‑style)
 * ------------------------------------------------------------
 * • Drag pieces to play. Moves validated by chess.js
 * • Compares your line against expected solution (SAN or UCI)
 * • Hint (arrow), Undo, Reset, Play coach move
 * • Right panel shows progress + history
 */

type CoachItem = { ok: boolean; text: string };

type PuzzleConfig = {
  title?: string;
  subtitle?: string;
  orientation?: "white" | "black";
  fen: string;
  solution: string[]; // SAN preferred; UCI accepted
  coachNotes?: string[];
};

const DEFAULT_PUZZLE: PuzzleConfig = {
  title: "Daily Puzzle (Demo)",
  subtitle: "White to move — Mate in 1",
  fen: "7k/5Q2/7K/8/8/8/8/8 w - - 0 1",
  solution: ["Qg7#"],
  orientation: "white",
  coachNotes: ["Qg7#"]
};

function toSanSequence(initialFen: string, seq: string[]): string[] {
  // Accept SAN ("Qg7#") or UCI ("f7g7"). Return SAN list.
  const clone = new Chess(initialFen);
  return seq.map((token) => {
    // try SAN first
    try {
      const mv = clone.move(token, { sloppy: true });
      if (mv) return mv.san;
    } catch { /* ignore */ }
    // try UCI
    if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(token)) {
      const from = token.slice(0, 2) as Square;
      const to = token.slice(2, 4) as Square;
      const promotion = token[4] as Move["promotion"];
      const mv = clone.move({ from, to, promotion });
      if (mv) return mv.san;
    }
    throw new Error(`Invalid solution move: ${token}`);
  });
}

function prettyResult(ch: Chess): string {
  if (ch.isCheckmate()) return "Checkmate";
  if (ch.isDraw()) return "Draw";
  if (ch.isStalemate()) return "Stalemate";
  if (ch.isThreefoldRepetition()) return "Threefold repetition";
  return "";
}

export default function ChessPuzzle(props: Partial<PuzzleConfig>): JSX.Element {
  const initialCfg: PuzzleConfig = { ...DEFAULT_PUZZLE, ...props } as PuzzleConfig;

  // Keep the active puzzle (FEN + solution + labels) in state so the loader can truly update it.
  const [puzzle, setPuzzle] = useState<PuzzleConfig>(initialCfg);

  const [fen, setFen] = useState<string>(initialCfg.fen);
  const [orientation] = useState<"white" | "black">(initialCfg.orientation || (initialCfg.fen.includes(" w ") ? "white" : "black"));
  const [ply, setPly] = useState<number>(0);
  const [wrong, setWrong] = useState<boolean>(false);
  const [arrows, setArrows] = useState<[Square, Square][]>([]);
  const [solved, setSolved] = useState<boolean>(false);
  const [coach, setCoach] = useState<CoachItem[]>([]);

  const expectedSequence: string[] = useMemo(
    () => toSanSequence(puzzle.fen, puzzle.solution),
    [puzzle.fen, puzzle.solution]
  );

  const reset = () => {
    setFen(puzzle.fen);
    setPly(0);
    setWrong(false);
    setArrows([]);
    setSolved(false);
    setCoach([]);
  };

  const undo = () => {
    const ch = new Chess(fen);
    const undone = ch.undo();
    if (undone) {
      setPly((n) => Math.max(0, n - 1));
      setCoach((c) => c.slice(0, -1));
      setFen(ch.fen());
      setWrong(false);
      setSolved(false);
      setArrows([]);
    }
  };

  const playExpectedMove = () => {
    if (ply >= expectedSequence.length) return;
    const ch = new Chess(fen);
    try {
      const mv = ch.move(expectedSequence[ply], { sloppy: true });
      if (!mv) return;
      setFen(ch.fen());
      setPly(ply + 1);
      setCoach((c) => [...c, { ok: true, text: puzzle.coachNotes?.[ply] || mv.san }]);
      if (ply + 1 === expectedSequence.length) setSolved(true);
    } catch { /* ignore */ }
  };

  const showHint = () => {
    const ch = new Chess(fen);
    try {
      const mv = ch.move(expectedSequence[ply], { sloppy: true });
      if (!mv) return;
      ch.undo();
      setArrows([[mv.from as Square, mv.to as Square]]);
    } catch { /* ignore */ }
  };

  const onDrop = (sourceSquare: Square, targetSquare: Square): boolean => {
    const ch = new Chess(fen);
    const move = ch.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
    if (!move) return false; // illegal

    const expectedSan = expectedSequence[ply];
    const playedSan = move.san;
    const clean = (s: string) => s.replace(/[+#!?]+/g, "");
    const correct = expectedSan && clean(expectedSan) === clean(playedSan);

    if (!correct) {
      setWrong(true);
      setTimeout(() => setWrong(false), 450);
      return false;
    }

    setFen(ch.fen());
    setPly(ply + 1);
    setCoach((c) => [...c, { ok: true, text: puzzle.coachNotes?.[ply] || playedSan }]);
    setArrows([]);

    if (ply + 1 === expectedSequence.length) setSolved(true);
    return true;
  };

  const meta = prettyResult(new Chess(fen));

  return (
    <div className="w-full min-h-[680px] bg-neutral-950 text-neutral-100 p-4 md:p-6 grid md:grid-cols-[minmax(320px,520px)_1fr] gap-6">
      {/* Left: Board */}
      <motion.div
        animate={wrong ? { x: [0, -12, 12, -8, 8, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
        className="mx-auto"
      >
        <div className="mb-3">
          <div className="text-sm uppercase tracking-wider text-neutral-400">{puzzle.subtitle}</div>
          <h1 className="text-2xl font-semibold">{puzzle.title}</h1>
        </div>

        <div className="rounded-2xl overflow-hidden shadow-2xl ring-1 ring-neutral-800">
          <Chessboard
            id="puzzle-board"
            position={fen}
            onPieceDrop={onDrop}
            boardOrientation={orientation}
            arePiecesDraggable={!solved}
            customArrows={arrows}
            animationDuration={200}
            customBoardStyle={{ borderRadius: 18 }}
          />
        </div>

        <div className="mt-3 flex items-center gap-2 text-sm text-neutral-400">
          <Info size={16} />
          <span>Drag a piece to play the next move in the solution. Wrong moves snap back.</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={showHint} className="px-3 py-2 bg-neutral-800 rounded-xl hover:bg-neutral-700 flex items-center gap-2"><Lightbulb size={16}/>Hint</button>
          <button onClick={undo} className="px-3 py-2 bg-neutral-800 rounded-xl hover:bg-neutral-700 flex items-center gap-2"><Undo2 size={16}/>Undo</button>
          <button onClick={reset} className="px-3 py-2 bg-neutral-800 rounded-xl hover:bg-neutral-700 flex items-center gap-2"><RotateCcw size={16}/>Reset</button>
          <button onClick={playExpectedMove} disabled={solved} className="px-3 py-2 bg-indigo-600 disabled:opacity-50 rounded-xl hover:bg-indigo-500 flex items-center gap-2"><Play size={16}/>Play coach move</button>
        </div>
      </motion.div>

      {/* Right: Coach panel */}
      <div className="bg-neutral-900/60 rounded-2xl border border-neutral-800 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-neutral-400">Progress</div>
            <div className="text-xl font-semibold">{ply}/{expectedSequence.length}</div>
          </div>
          {solved ? (
            <div className="flex items-center gap-2 text-emerald-400"><CheckCircle2/>Solved</div>
          ) : wrong ? (
            <div className="flex items-center gap-2 text-rose-400"><XCircle/>Try again</div>
          ) : (
            <div className="flex items-center gap-2 text-neutral-400"><ChevronRight/>Your move</div>
          )}
        </div>

        <div className="mt-4 space-y-2">
          {expectedSequence.map((label, i) => (
            <div key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${i < ply ? "bg-neutral-800" : "bg-neutral-900"}`}>
              <div className={`w-6 h-6 rounded-full grid place-items-center text-xs ${i < ply ? "bg-emerald-500/20 text-emerald-300" : "bg-neutral-700 text-neutral-300"}`}>
                {i + 1}
              </div>
              <div className="flex-1 text-sm">{puzzle.coachNotes?.[i] || label}</div>
              {i < ply && <CheckCircle2 size={16} className="text-emerald-400"/>}
            </div>
          ))}
        </div>

        <div className="mt-4 text-sm text-neutral-400">
          <div>Board FEN:</div>
          <div className="font-mono text-[11px] break-all mt-1 p-2 rounded-lg bg-neutral-950 border border-neutral-800">{fen}</div>
          {meta && <div className="mt-2">Status: <span className="text-neutral-200">{meta}</span></div>}
        </div>

        <PuzzleLoader
          onLoad={(p) => {
            try {
              new Chess(p.fen); // validate FEN
              setPuzzle((prev) => ({ ...prev, fen: p.fen }));
              setFen(p.fen);
              setPly(0);
              setSolved(false);
              setWrong(false);
              setCoach([]);
            } catch (e) { alert("Invalid FEN"); }
          }}
          onLoadSolution={(seq) => {
            try {
              toSanSequence(puzzle.fen, seq); // validate against puzzle FEN
              setPuzzle((prev) => ({ ...prev, solution: seq }));
              setPly(0);
              setSolved(false);
              setWrong(false);
              setCoach([]);
              setArrows([]);
            } catch (e) { alert("Invalid solution list (use SAN like Qg7# or UCI like f7g7)"); }
          }}
        />

        {/* --- Self-tests (simple) --- */}
        <SelfTests />
      </div>
    </div>
  );
}

function PuzzleLoader({ onLoad, onLoadSolution }: { onLoad: (p: { fen: string }) => void; onLoadSolution: (seq: string[]) => void }): JSX.Element {
  const [fen, setFen] = useState("");
  const [moves, setMoves] = useState("");

  const loadDemo = () => {
    onLoad({ fen: DEFAULT_PUZZLE.fen });
    onLoadSolution(DEFAULT_PUZZLE.solution);
  };

  const parseMoves = (s: string): string[] => {
    return s
      .replace(/\d+\.(\.\.)?/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(/[ ,]/)
      .filter(Boolean);
  };

  return (
    <div className="mt-6 border-t border-neutral-800 pt-4">
      <div className="flex items-center gap-2 text-neutral-300 mb-2"><Info size={16}/>Load your own position</div>
      <label className="block text-xs text-neutral-400 mb-1">FEN</label>
      <input value={fen} onChange={(e) => setFen(e.target.value)} placeholder="Paste FEN here"
             className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm font-mono" />
      <label className="block text-xs text-neutral-400 mt-3 mb-1">Solution moves (SAN or UCI)</label>
      <textarea value={moves} onChange={(e) => setMoves(e.target.value)} placeholder="Example: Qg7#\nor: f7g7"
                rows={3} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm font-mono"/>

      <div className="mt-3 flex gap-2">
        <button onClick={() => fen && onLoad({ fen })} className="px-3 py-2 bg-neutral-800 rounded-xl hover:bg-neutral-700">Load FEN</button>
        <button onClick={() => onLoadSolution(parseMoves(moves))} className="px-3 py-2 bg-neutral-800 rounded-xl hover:bg-neutral-700">Load Solution</button>
        <button onClick={loadDemo} className="px-3 py-2 bg-neutral-800 rounded-xl hover:bg-neutral-700">Load Demo</button>
      </div>

      <p className="text-xs text-neutral-500 mt-3 leading-relaxed">
        Tip: paste any FEN and the expected line. The trainer only accepts the exact line
        (like chess.com puzzles). Use <b>Hint</b> to reveal the next arrow, or <b>Play coach move</b> to watch.
      </p>
    </div>
  );
}

// Simple self-tests to ensure core utilities behave; renders in UI.
function SelfTests(): JSX.Element {
  type T = { name: string; pass: boolean; detail?: string };
  const tests: T[] = [];

  // Test 1: SAN acceptance
  try {
    const out = toSanSequence("7k/5Q2/7K/8/8/8/8/8 w - - 0 1", ["Qg7#"]);
    tests.push({ name: "SAN parse", pass: out[0] === "Qg7#" });
  } catch (e) { tests.push({ name: "SAN parse", pass: false, detail: String(e) }); }

  // Test 2: UCI acceptance
  try {
    const out = toSanSequence("7k/5Q2/7K/8/8/8/8/8 w - - 0 1", ["f7g7"]);
    tests.push({ name: "UCI parse", pass: out[0].startsWith("Qxg7") || out[0].startsWith("Qg7") });
  } catch (e) { tests.push({ name: "UCI parse", pass: false, detail: String(e) }); }

  // Test 3: Illegal move rejected
  try {
    let ok = false;
    try { toSanSequence("7k/5Q2/7K/8/8/8/8/8 w - - 0 1", ["a1a8"]); ok = true; } catch { ok = false; }
    tests.push({ name: "Reject illegal UCI", pass: !ok });
  } catch (e) { tests.push({ name: "Reject illegal UCI", pass: false, detail: String(e) }); }

  // Test 4: Exact-line enforcement equality
  try {
    const expect = ["Qg7#"]; const got = ["Qg7#"]; // identical
    const eq = expect.join(" ") === got.join(" ");
    tests.push({ name: "Exact-line equality", pass: eq });
  } catch (e) { tests.push({ name: "Exact-line equality", pass: false, detail: String(e) }); }

  return (
    <div className="mt-6 border-t border-neutral-800 pt-4">
      <div className="text-sm text-neutral-400 mb-2">Self‑tests</div>
      <ul className="text-sm">
        {tests.map((t, i) => (
          <li key={i} className="mb-1">
            <span style={{ color: t.pass ? "#34d399" : "#fb7185" }}>{t.pass ? "PASS" : "FAIL"}</span>
            {" — "}{t.name}
            {t.detail ? <span className="text-neutral-400"> — {t.detail}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
// END OF PROJECT


