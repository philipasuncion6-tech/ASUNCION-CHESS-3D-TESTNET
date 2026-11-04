import chessPackage from "chess.js";
import "./style.css";

// chess.js 0.10.3 is CommonJS; this handles its default export in Vite.
const Chess = chessPackage.Chess || chessPackage.default?.Chess || chessPackage.default || chessPackage;
const game = new Chess();

const $ = (id) => document.getElementById(id);
const boardEl = $("board");
const statusTitle = $("status-title");
const statusText = $("status-text");
const statusIcon = $("status-icon");
const thinkingDots = $("thinking-dots");
const computerTurn = $("computer-turn");
const playerTurn = $("player-turn");
const moveList = $("move-list");
const toast = $("toast");
const promotionModal = $("promotion-modal");
const promotionOptions = $("promotion-options");

const GLYPHS = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟"
};
const VALUES = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 20000 };
const FILES = "abcdefgh";
let selected = null;
let legalTargets = [];
let flipped = false;
let thinking = false;
let pendingPromotion = null;
let toastTimer = null;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}
function isComputerTurn() { return game.turn() === "w"; }
function gameEnded() { return game.game_over(); }

function render() {
  boardEl.innerHTML = "";
  const squares = [];
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const square = FILES[file] + (8 - rank);
      squares.push(square);
    }
  }
  if (flipped) squares.reverse();

  const last = game.history({ verbose: true }).slice(-1)[0];
  const checkedKing = game.in_check() ? findKingSquare(game.turn()) : null;

  for (const square of squares) {
    const piece = game.get(square);
    const file = FILES.indexOf(square[0]);
    const rank = Number(square[1]);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "square " + ((file + rank) % 2 === 0 ? "sq-light" : "sq-dark");
    cell.setAttribute("aria-label", `${square}${piece ? " " + piece.color + " " + piece.type : ""}`);
    cell.dataset.square = square;

    if (selected === square) cell.classList.add("selected");
    if (last && (last.from === square || last.to === square)) cell.classList.add("last-move");
    if (checkedKing === square) cell.classList.add("in-check");

    if (legalTargets.includes(square)) {
      cell.classList.add(piece ? "capture-target" : "move-target");
    }

    if (piece) {
      const pieceEl = document.createElement("span");
      pieceEl.className = "piece " + (piece.color === "w" ? "white-piece" : "black-piece");
      pieceEl.textContent = GLYPHS[piece.color + piece.type];
      cell.appendChild(pieceEl);
    }

    const shownFile = flipped ? FILES[7-file] : FILES[file];
    const shownRank = flipped ? 9-rank : rank;
    if ((!flipped && file === 0) || (flipped && file === 7)) {
      const coord = document.createElement("span");
      coord.className = "coordinate rank-coordinate";
      coord.textContent = shownRank;
      cell.appendChild(coord);
    }
    if ((!flipped && rank === 1) || (flipped && rank === 8)) {
      const coord = document.createElement("span");
      coord.className = "coordinate file-coordinate";
      coord.textContent = shownFile;
      cell.appendChild(coord);
    }

    cell.addEventListener("click", () => onSquareClick(square));
    boardEl.appendChild(cell);
  }
  updatePanels();
}

function findKingSquare(color) {
  const squares = game.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = squares[r][f];
      if (p && p.type === "k" && p.color === color) return FILES[f] + (8-r);
    }
  }
  return null;
}

function updatePanels() {
  const over = gameEnded();
  const turn = game.turn();
  const inCheck = game.in_check();
  const history = game.history();
  const moveNumber = Math.floor(history.length / 2) + 1;

  $("side-to-move").textContent = turn === "w" ? "White" : "Black";
  $("move-number").textContent = String(moveNumber);
  $("game-result").textContent = over ? (game.in_checkmate() ? "Checkmate" : "Draw") : "In progress";

  computerTurn.classList.toggle("active", turn === "w" && !over);
  playerTurn.classList.toggle("active", turn === "b" && !over);
  computerTurn.textContent = thinking ? "THINKING" : (turn === "w" && !over ? "TO MOVE" : "WAITING");
  playerTurn.textContent = turn === "b" && !over ? "YOUR TURN" : "WAITING";
  thinkingDots.classList.toggle("visible", thinking);

  if (game.in_checkmate()) {
    const winner = turn === "w" ? "Black wins!" : "White wins!";
    statusIcon.textContent = "♛";
    statusTitle.textContent = "CHECKMATE";
    statusText.textContent = winner;
  } else if (game.in_draw()) {
    statusIcon.textContent = "½";
    statusTitle.textContent = "Game drawn";
    statusText.textContent = "The game has ended in a draw.";
  } else if (thinking) {
    statusIcon.textContent = "♜";
    statusTitle.textContent = "Computer is thinking…";
    statusText.textContent = "The computer is calculating its next move.";
  } else if (turn === "b") {
    statusIcon.textContent = inCheck ? "⚠" : "♟";
    statusTitle.textContent = inCheck ? "Your king is in check!" : "Your turn — play as Black";
    statusText.textContent = inCheck ? "Move your king or block/capture the attacking piece." : "Select one of your black pieces, then choose a highlighted square.";
  } else {
    statusIcon.textContent = "♔";
    statusTitle.textContent = "Computer to move";
    statusText.textContent = "White plays against you.";
  }

  renderHistory();
}

function renderHistory() {
  const history = game.history();
  if (!history.length) {
    moveList.innerHTML = '<div class="empty-history">Moves will appear here.</div>';
    return;
  }
  moveList.innerHTML = "";
  for (let i = 0; i < history.length; i += 2) {
    const row = document.createElement("div");
    row.className = "move-row";
    const num = document.createElement("span");
    num.className = "move-num";
    num.textContent = `${Math.floor(i / 2) + 1}.`;
    const white = document.createElement("span");
    white.className = "white-notation";
    white.textContent = history[i] || "—";
    const black = document.createElement("span");
    black.className = "black-notation";
    black.textContent = history[i + 1] || "…";
    row.append(num, white, black);
    moveList.appendChild(row);
  }
  moveList.scrollTop = moveList.scrollHeight;
}

function onSquareClick(square) {
  if (thinking || gameEnded() || isComputerTurn() || pendingPromotion) return;
  const piece = game.get(square);

  if (selected) {
    const candidates = game.moves({ square: selected, verbose: true }).filter(m => m.to === square);
    if (candidates.length) {
      const promotionMoves = candidates.filter(m => m.promotion);
      if (promotionMoves.length) {
        openPromotion(promotionMoves);
        return;
      }
      makePlayerMove(selected, square);
      return;
    }
  }

  if (piece && piece.color === "b") {
    selected = square;
    legalTargets = game.moves({ square, verbose: true }).map(m => m.to);
  } else {
    selected = null;
    legalTargets = [];
  }
  render();
}

function makePlayerMove(from, to, promotion = "q") {
  const result = game.move({ from, to, promotion });
  selected = null;
  legalTargets = [];
  render();
  if (result) {
    if (!gameEnded()) window.setTimeout(computerMove, 350);
  } else {
    showToast("That move is not legal.");
  }
}

function openPromotion(moves) {
  pendingPromotion = moves;
  promotionOptions.innerHTML = "";
  const choices = [
    ["q", "♛", "Queen"], ["r", "♜", "Rook"],
    ["b", "♝", "Bishop"], ["n", "♞", "Knight"]
  ];
  for (const [type, glyph, label] of choices) {
    const button = document.createElement("button");
    button.className = "promotion-choice";
    button.innerHTML = `<span>${glyph}</span><small>${label}</small>`;
    button.addEventListener("click", () => {
      const move = pendingPromotion.find(m => m.promotion === type);
      if (move) makePlayerMove(move.from, move.to, type);
      closePromotion();
    });
    promotionOptions.appendChild(button);
  }
  promotionModal.classList.remove("hidden");
}
function closePromotion() {
  pendingPromotion = null;
  promotionModal.classList.add("hidden");
}

function evaluatePosition() {
  if (game.in_checkmate()) return game.turn() === "w" ? -100000 : 100000;
  if (game.in_draw()) return 0;
  let score = 0;
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (!p) continue;
      const value = VALUES[p.type];
      const advancement = p.type === "p" ? (p.color === "w" ? 6-r : r-1) * 7 : 0;
      const center = 3.5 - (Math.abs(3.5-f) + Math.abs(3.5-r)) / 2;
      const positional = p.type === "n" || p.type === "b" ? center * 5 : 0;
      score += (p.color === "w" ? 1 : -1) * (value + advancement + positional);
    }
  }
  return score;
}

function minimax(depth, alpha, beta, maximizing) {
  if (depth === 0 || game.game_over()) return evaluatePosition();
  const moves = game.moves({ verbose: true });
  if (maximizing) {
    let best = -Infinity;
    for (const m of orderMoves(moves)) {
      game.move(m);
      best = Math.max(best, minimax(depth - 1, alpha, beta, false));
      game.undo();
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of orderMoves(moves)) {
      game.move(m);
      best = Math.min(best, minimax(depth - 1, alpha, beta, true));
      game.undo();
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

function orderMoves(moves) {
  return moves.slice().sort((a, b) => {
    const score = m => (m.captured ? VALUES[m.captured] * 10 : 0) + (m.promotion ? VALUES[m.promotion] : 0);
    return score(b) - score(a);
  });
}

function computerMove() {
  if (thinking || gameEnded() || !isComputerTurn()) return;
  thinking = true;
  updatePanels();

  window.setTimeout(() => {
    const moves = orderMoves(game.moves({ verbose: true }));
    if (!moves.length) {
      thinking = false;
      render();
      return;
    }

    let bestScore = -Infinity;
    let bestMoves = [];
    for (const move of moves) {
      game.move(move);
      const score = minimax(2, -Infinity, Infinity, false);
      game.undo();
      if (score > bestScore) {
        bestScore = score;
        bestMoves = [move];
      } else if (score === bestScore) {
        bestMoves.push(move);
      }
    }
    const chosen = bestMoves[Math.floor(Math.random() * bestMoves.length)] || moves[0];
    game.move({ from: chosen.from, to: chosen.to, promotion: chosen.promotion || "q" });
    thinking = false;
    selected = null;
    legalTargets = [];
    render();
  }, 120);
}

function newGame() {
  game.reset();
  selected = null;
  legalTargets = [];
  thinking = false;
  closePromotion();
  render();
  window.setTimeout(computerMove, 450);
}

function undoTurn() {
  if (thinking || game.history().length === 0) return;
  closePromotion();
  selected = null;
  legalTargets = [];
  // Undo a player's move and the computer's preceding move, where available.
  if (game.turn() === "w") {
    game.undo(); // undo computer's last move
    if (game.history().length) game.undo(); // undo player's last move
  } else {
    game.undo();
  }
  render();
  if (game.turn() === "w" && game.history().length === 0) {
    window.setTimeout(computerMove, 350);
  }
}

$("new-game").addEventListener("click", newGame);
$("undo").addEventListener("click", undoTurn);
$("flip").addEventListener("click", () => {
  flipped = !flipped;
  render();
});
$("cancel-promotion").addEventListener("click", closePromotion);

// Computer is White and makes the opening move.
render();
window.setTimeout(computerMove, 500);
