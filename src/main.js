import chessPackage from "chess.js";
import "./style.css";

const Chess =
  chessPackage.Chess ||
  chessPackage.default?.Chess ||
  chessPackage.default ||
  chessPackage;

const game = new Chess();

const $ = (id) => document.getElementById(id);

const boardElement = $("board");
const statusTitle = $("status-title");
const statusText = $("status-text");
const statusIcon = $("status-icon");
const thinkingDots = $("thinking-dots");
const computerTurn = $("computer-turn");
const playerTurn = $("player-turn");
const moveList = $("move-list");
const toastElement = $("toast");
const promotionModal = $("promotion-modal");
const promotionOptions = $("promotion-options");

const glyphs = {
  w: {
    k: "♔", q: "♕", r: "♖",
    b: "♗", n: "♘", p: "♙"
  },
  b: {
    k: "♚", q: "♛", r: "♜",
    b: "♝", n: "♞", p: "♟"
  }
};

const pieceValues = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000
};

let selectedSquare = null;
let legalTargets = [];
let lastMove = null;
let flipped = true;
let thinking = false;
let pendingPromotion = null;
let toastTimer = null;
let computerMoveToken = 0;

// AI SETTINGS
const MATE_SCORE = 100000;
const AI_SEARCH_DEPTH = 3;

function showToast(message) {
  toastElement.textContent = message;
  toastElement.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastElement.classList.remove("show");
  }, 2200);
}

function squareName(file, rank) {
  return "abcdefgh"[file] + rank;
}

function findKing(color) {
  const rows = game.board();

  for (const row of rows) {
    for (const piece of row) {
      if (piece && piece.type === "k" && piece.color === color) {
        return piece.square;
      }
    }
  }

  return null;
}

function renderBoard() {
  boardElement.innerHTML = "";

  const rows = flipped
    ? [1, 2, 3, 4, 5, 6, 7, 8]
    : [8, 7, 6, 5, 4, 3, 2, 1];

  const files = flipped
    ? [7, 6, 5, 4, 3, 2, 1, 0]
    : [0, 1, 2, 3, 4, 5, 6, 7];

  const checkedKing = game.in_check()
    ? findKing(game.turn())
    : null;

  const history = game.history({ verbose: true });

  lastMove = history.length
    ? history[history.length - 1]
    : null;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const rank = rows[row];
      const file = files[col];
      const name = squareName(file, rank);
      const piece = game.get(name);

      const square = document.createElement("div");
      square.className = "square";

      const isLight = (file + rank) % 2 === 1;
      square.classList.add(isLight ? "sq-light" : "sq-dark");

      square.dataset.square = name;

      if (selectedSquare === name) {
        square.classList.add("selected");
      }

      if (
        lastMove &&
        (lastMove.from === name || lastMove.to === name)
      ) {
        square.classList.add("last-move");
      }

      if (checkedKing === name) {
        square.classList.add("in-check");
      }

      if (legalTargets.includes(name)) {
        square.classList.add(
          piece ? "capture-target" : "move-target"
        );
      }

      if (piece) {
        const pieceElement = document.createElement("span");

        pieceElement.className =
          "piece " +
          (piece.color === "w" ? "white-piece" : "black-piece");

        pieceElement.textContent = glyphs[piece.color][piece.type];

        square.appendChild(pieceElement);
      }

      if (col === 0) {
        const rankLabel = document.createElement("span");
        rankLabel.className = "coordinate rank-coordinate";
        rankLabel.textContent = rank;
        square.appendChild(rankLabel);
      }

      if (row === 7) {
        const fileLabel = document.createElement("span");
        fileLabel.className = "coordinate file-coordinate";
        fileLabel.textContent = "abcdefgh"[file];
        square.appendChild(fileLabel);
      }

      square.addEventListener("click", () => {
        handleSquareClick(name);
      });

      boardElement.appendChild(square);
    }
  }
}

function clearSelection() {
  selectedSquare = null;
  legalTargets = [];
}

function handleSquareClick(name) {
  if (thinking || game.game_over() || pendingPromotion) {
    return;
  }

  // Player controls Black only.
  if (game.turn() !== "b") {
    showToast("Wait for the computer to move.");
    return;
  }

  const piece = game.get(name);

  if (selectedSquare) {
    const moves = game.moves({
      square: selectedSquare,
      verbose: true
    });

    const matchingMoves = moves.filter(
      move => move.to === name
    );

    if (matchingMoves.length > 0) {
      if (matchingMoves.some(move => move.promotion)) {
        openPromotion(matchingMoves);
      } else {
        makePlayerMove(selectedSquare, name);
      }
      return;
    }
  }

  if (piece && piece.color === "b") {
    selectedSquare = name;

    legalTargets = game.moves({
      square: name,
      verbose: true
    }).map(move => move.to);

    renderBoard();
    return;
  }

  clearSelection();
  renderBoard();
}

function makePlayerMove(from, to, promotion = "q") {
  let move;

  try {
    move = game.move({
      from,
      to,
      promotion
    });
  } catch (error) {
    move = null;
  }

  closePromotion();
  clearSelection();

  if (!move) {
    showToast("Invalid move.");
    render();
    return;
  }

  render();

  if (!game.game_over()) {
    startComputerMove();
  }
}

function openPromotion(moves) {
  pendingPromotion = moves;
  promotionOptions.innerHTML = "";

  const choices = ["q", "r", "b", "n"];

  choices.forEach(type => {
    const button = document.createElement("button");

    button.className = "promotion-choice";
    button.textContent = glyphs.b[type];
    button.setAttribute("aria-label", type);

    button.addEventListener("click", () => {
      const move = pendingPromotion.find(
        item => item.promotion === type
      );

      if (move) {
        makePlayerMove(move.from, move.to, type);
      }
    });

    promotionOptions.appendChild(button);
  });

  promotionModal.classList.remove("hidden");
  promotionModal.classList.add("show");
}

function closePromotion() {
  pendingPromotion = null;
  promotionModal.classList.add("hidden");
  promotionModal.classList.remove("show");
}

// ======================================
// CHESS AI - POSITION EVALUATION
// ======================================

function evaluatePosition(position, ply = 0) {
  if (position.in_checkmate()) {
    return position.turn() === "w"
      ? -MATE_SCORE + ply
      : MATE_SCORE - ply;
  }

  if (position.game_over()) return 0;

  let score = 0;
  const rows = position.board();

  let whiteBishops = 0;
  let blackBishops = 0;

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = rows[r][f];

      if (!piece) continue;

      const sign = piece.color === "w" ? 1 : -1;

      let value = pieceValues[piece.type];

      const centerDistance =
        Math.abs(3.5 - f) + Math.abs(3.5 - r);

      const centerBonus =
        Math.round((7 - centerDistance) * 3);

      value += centerBonus;

      // Encourage pawn advancement.
      if (piece.type === "p") {
        const advance = piece.color === "w"
          ? 6 - r
          : r - 1;

        value += Math.max(0, advance) * 7;
      }

      if (piece.type === "b") {
        if (piece.color === "w") {
          whiteBishops++;
        } else {
          blackBishops++;
        }
      }

      score += sign * value;
    }
  }

  // Bishop pair bonus.
  if (whiteBishops >= 2) score += 30;
  if (blackBishops >= 2) score -= 30;

  return score;
}

// ======================================
// MOVE ORDERING
// ======================================

function moveOrderScore(move) {
  let score = 0;

  if (move.captured) {
    score +=
      10 * pieceValues[move.captured] -
      pieceValues[move.piece] / 10;
  }

  if (move.promotion) {
    score += pieceValues[move.promotion] + 800;
  }

  if (move.san && move.san.includes("+")) {
    score += 50;
  }

  if (move.san && move.san.includes("#")) {
    score += 100000;
  }

  return score;
}

function orderedMoves(position) {
  return position.moves({ verbose: true })
    .sort((a, b) => moveOrderScore(b) - moveOrderScore(a));
}

// ======================================
// MINIMAX + ALPHA BETA PRUNING
// ======================================

function minimax(
  position,
  depth,
  alpha,
  beta,
  maximizing,
  ply = 0
) {
  if (
    position.in_checkmate() ||
    position.game_over() ||
    depth <= 0
  ) {
    return evaluatePosition(position, ply);
  }

  const moves = orderedMoves(position);

  if (!moves.length) {
    return evaluatePosition(position, ply);
  }

  if (maximizing) {
    let best = -Infinity;

    for (const move of moves) {
      position.move(move.san);

      let score;

      try {
        score = minimax(
          position,
          depth - 1,
          alpha,
          beta,
          false,
          ply + 1
        );
      } finally {
        position.undo();
      }

      best = Math.max(best, score);
      alpha = Math.max(alpha, best);

      if (beta <= alpha) break;
    }

    return best;
  }

  let best = Infinity;

  for (const move of moves) {
    position.move(move.san);

    let score;

    try {
      score = minimax(
        position,
        depth - 1,
        alpha,
        beta,
        true,
        ply + 1
      );
    } finally {
      position.undo();
    }

    best = Math.min(best, score);
    beta = Math.min(beta, best);

    if (beta <= alpha) break;
  }

  return best;
}

// ======================================
// COMPUTER MOVE SELECTION
// Computer is WHITE.
// Player is BLACK.
// ======================================

function chooseComputerMove() {
  const moves = orderedMoves(game);

  if (!moves.length) return null;

  let bestScore = -Infinity;
  let bestMoves = [];

  for (const move of moves) {
    game.move(move.san);

    let score;

    try {
      score = minimax(
        game,
        AI_SEARCH_DEPTH - 1,
        -Infinity,
        Infinity,
        false,
        1
      );
    } finally {
      game.undo();
    }

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }

  // Random only among equally strong moves.
  return bestMoves[
    Math.floor(Math.random() * bestMoves.length)
  ] || moves[0];
}

// ======================================
// COMPUTER TURN
// ======================================

function startComputerMove() {
  if (
    game.game_over() ||
    game.turn() !== "w" ||
    thinking
  ) {
    render();
    return;
  }

  const token = ++computerMoveToken;

  thinking = true;
  render();

  setTimeout(() => {
    // Ignore an old delayed move after New Game or Undo.
    if (token !== computerMoveToken) return;

    let errorMessage = "";

    try {
      if (
        !game.game_over() &&
        game.turn() === "w"
      ) {
        const move = chooseComputerMove();

        if (!move) {
          throw new Error("No legal computer move found.");
        }

        const played = game.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion || "q"
        });

        if (!played) {
          throw new Error("Computer move was rejected.");
        }
      }
    } catch (error) {
      console.error("Computer AI error:", error);
      errorMessage = "Computer error: " + error.message;
    } finally {
      if (token === computerMoveToken) {
        thinking = false;
        clearSelection();
        render();

        if (errorMessage) {
          showToast(errorMessage);
        }
      }
    }
  }, 250);
}

// ======================================
// MOVE HISTORY
// ======================================

function updateHistory() {
  const history = game.history({ verbose: true });

  if (!history.length) {
    moveList.innerHTML =
      '<div class="empty-history">Moves will appear here.</div>';
    return;
  }

  moveList.innerHTML = "";

  for (let i = 0; i < history.length; i += 2) {
    const whiteMove = history[i];
    const blackMove = history[i + 1];

    const row = document.createElement("div");
    row.className = "move-row";

    const number = document.createElement("span");
    number.className = "move-num";
    number.textContent = `${Math.floor(i / 2) + 1}.`;

    const white = document.createElement("span");
    white.className = "white-notation";
    white.textContent = whiteMove.san;

    const black = document.createElement("span");
    black.className = "black-notation";
    black.textContent = blackMove ? blackMove.san : "…";

    row.append(number, white, black);
    moveList.appendChild(row);
  }
}

// ======================================
// GAME STATUS AND PANELS
// ======================================

function updatePanels() {
  const whiteToMove = game.turn() === "w";
  const over = game.game_over();

  $("side-to-move").textContent =
    whiteToMove ? "White" : "Black";

  $("move-number").textContent =
  Math.floor(game.history().length / 2) + 1;

  let result = "In progress";
  let title = "Your turn";
  let message = "Choose one of your Black pieces.";
  let icon = "♟";

  if (game.in_checkmate()) {
    result = whiteToMove ? "Black wins" : "White wins";

    title = whiteToMove
      ? "Computer wins!"
      : "Checkmate! You win!";

    message = "The game has ended by checkmate.";
    icon = "♛";
  } else if (game.in_stalemate()) {
    result = "Draw";
    title = "Stalemate!";
    message = "Neither side can make a legal move.";
    icon = "½";
  } else if (game.in_draw()) {
    result = "Draw";
    title = "Game drawn";
    message = "The game ended in a draw.";
    icon = "½";
  } else if (thinking) {
    title = "Computer is thinking...";
    message = "The computer is calculating its next move.";
    icon = "♚";
  } else if (whiteToMove) {
    title = "Computer's turn";
    message = "The computer is preparing its move.";
    icon = "♚";
  } else if (game.in_check()) {
    title = "You are in check!";
    message = "Protect your king immediately.";
    icon = "⚠";
  }

  $("game-result").textContent = result;
  statusTitle.textContent = title;
  statusText.textContent = message;
  statusIcon.textContent = icon;

  computerTurn.textContent = thinking
    ? "THINKING"
    : whiteToMove && !over
      ? "COMPUTER TURN"
      : "COMPUTER";

  playerTurn.textContent =
    !whiteToMove && !over ? "YOUR TURN" : "WAIT";

  computerTurn.classList.toggle(
    "active",
    whiteToMove && !over
  );

  playerTurn.classList.toggle(
    "active",
    !whiteToMove && !over
  );

  thinkingDots.classList.toggle("visible", thinking);
}

function render() {
  renderBoard();
  updatePanels();
  updateHistory();
}

// ======================================
// NEW GAME
// ======================================

function newGame() {
  computerMoveToken++;

  game.reset();

  clearSelection();
  closePromotion();

  thinking = false;

  render();

  showToast("New game started!");

  // Computer plays White first.
  startComputerMove();
}

// ======================================
// UNDO
// ======================================

function undoMove() {
  if (thinking || pendingPromotion) return;

  if (game.history().length === 0) {
    showToast("No moves to undo.");
    return;
  }

  computerMoveToken++;

  // Remove computer's last move.
  game.undo();

  // Remove player's previous move too.
  if (
    game.turn() === "b" &&
    game.history().length > 0
  ) {
    game.undo();
  }

  clearSelection();
  closePromotion();

  thinking = false;

  render();

  showToast("Previous turn restored.");
}

// ======================================
// FLIP BOARD
// ======================================

function flipBoard() {
  flipped = !flipped;
  renderBoard();
}

// ======================================
// BUTTON EVENTS
// ======================================

$("new-game").addEventListener("click", newGame);

$("undo").addEventListener("click", undoMove);

$("flip").addEventListener("click", flipBoard);

$("cancel-promotion").addEventListener("click", () => {
  closePromotion();
  clearSelection();
  renderBoard();
});

// ======================================
// START GAME
// ======================================

// Computer plays White first.
// Player controls Black.

render();
startComputerMove();
