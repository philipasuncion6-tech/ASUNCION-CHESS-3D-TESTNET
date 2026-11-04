
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

function evaluatePosition(position) {
  if (position.in_checkmate()) {
    return position.turn() === "w" ? -100000 : 100000;
  }

  if (position.game_over()) {
    return 0;
  }

  let score = 0;
  const rows = position.board();

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = rows[r][f];

      if (!piece) continue;

      let value = pieceValues[piece.type];

      // Small center-control bonus.
      const centerDistance =
        Math.abs(3.5 - f) + Math.abs(3.5 - r);

      value += Math.round((7 - centerDistance) * 3);

      score += piece.color === "w" ? value : -value;
    }
  }

  return score;
}

function minimax(position, depth, alpha, beta, maximizing) {
  if (depth === 0 || position.game_over()) {
    return evaluatePosition(position);
  }

  const moves = position.moves({ verbose: true });

  if (maximizing) {
    let best = -Infinity;

    for (const move of moves) {
      const made = position.move(move.san);
      if (!made) continue;

      let score;
      try {
        score = minimax(position, depth - 1, alpha, beta, false);
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
    const made = position.move(move.san);
    if (!made) continue;

    let score;
    try {
      score = minimax(position, depth - 1, alpha, beta, true);
    } finally {
      position.undo();
    }

    best = Math.min(best, score);
    beta = Math.min(beta, best);

    if (beta <= alpha) break;
  }

  return best;
}

function chooseComputerMove() {
  const moves = game.moves({ verbose: true });
  if (!moves.length) return null;

  let bestScore = -Infinity;
  let bestMoves = [];

  for (const move of moves) {
    let score = Math.random() * 8;

    if (move.captured) {
      score += (pieceValues[move.captured] || 0) -
        (pieceValues[move.piece] || 0) * 0.25;
    }

    if (move.promotion) {
      score += pieceValues[move.promotion] || 0;
    }

    const file = "abcdefgh".indexOf(move.to[0]);
    const rank = Number(move.to[1]);

    const centerDistance =
      Math.abs(3.5 - file) + Math.abs(3.5 - (rank - 1));

    score += (7 - centerDistance) * 4;

    if (move.flags &&
        (move.flags.includes("k") || move.flags.includes("q"))) {
      score += 25;
    }

    if (move.san &&
        (move.san.includes("+") || move.san.includes("#"))) {
      score += 35;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }

  return bestMoves.length
    ? bestMoves[Math.floor(Math.random() * bestMoves.length)]
    : null;
}

  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

function startComputerMove() {
  if (game.game_over() || game.turn() !== "w") {
    render();
    return;
  }

  thinking = true;
  render();

  setTimeout(() => {
    let errorMessage = "";

    try {
      if (!game.game_over() && game.turn() === "w") {
        const move = chooseComputerMove();
        if (!move) throw new Error("No legal computer move found.");

        const played = game.move({
  from: move.from,
  to: move.to,
  promotion: move.promotion || "q"
});
        if (!played) throw new Error("Computer move was rejected.");
      }
    } catch (error) {
      console.error("Computer AI error:", error);
      errorMessage = "Computer error: " + error.message;
    } finally {
      thinking = false;
      clearSelection();
      render();

      if (errorMessage) showToast(errorMessage);
    }
  }, 450);
}
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
function updatePanels() {
  const whiteToMove = game.turn() === "w";
  const over = game.game_over();

  $("side-to-move").textContent =
    whiteToMove ? "White" : "Black";

  $("move-number").textContent = game.move_number();

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

  computerTurn.classList.toggle("active", whiteToMove && !over);
  playerTurn.classList.toggle("active", !whiteToMove && !over);

  thinkingDots.classList.toggle("visible", thinking);
}

function render() {
  renderBoard();
  updatePanels();
  updateHistory();
}

function newGame() {
  game.reset();

  clearSelection();
  closePromotion();

  thinking = false;

  render();
  showToast("New game started!");

  startComputerMove();
}

function undoMove() {
  if (thinking || pendingPromotion) return;

  if (game.history().length === 0) {
    showToast("No moves to undo.");
    return;
  }

  // Remove the computer's last move.
  game.undo();

  // If the player had already moved, undo that move too.
  if (game.turn() === "b" && game.history().length > 0) {
    game.undo();
  }

  clearSelection();
  closePromotion();
  thinking = false;

  render();
  showToast("Previous turn restored.");
}

function flipBoard() {
  flipped = !flipped;
  renderBoard();
}

$("new-game").addEventListener("click", newGame);
$("undo").addEventListener("click", undoMove);
$("flip").addEventListener("click", flipBoard);

$("cancel-promotion").addEventListener("click", () => {
  closePromotion();
  clearSelection();
  renderBoard();
});

// Start the game. Computer plays White first.
render();
startComputerMove();
