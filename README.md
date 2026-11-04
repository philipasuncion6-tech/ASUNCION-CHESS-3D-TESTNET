# ASUNCION CHESS 3D

A Vite + chess.js + Capacitor Android chess game.

## Game controls
- Computer plays White and makes the first move.
- Player plays Black.
- Tap a black piece, then tap a highlighted destination.
- Pawn promotion offers Queen, Rook, Bishop, and Knight.
- Undo reverses the player's last move and the computer's preceding move when both exist.
- Flip Board changes the board view.

## Run locally
```bash
npm install
npm run dev
```

## Build web assets
```bash
npm run build
```

## Build Android
```bash
npm install
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

APK output:
`android/app/build/outputs/apk/debug/app-debug.apk`

## GitHub Actions
Push to `main`, or run **Build ASUNCION CHESS APK** manually from the Actions tab.
Download the `ASUNCION-CHESS-APK` artifact from the completed workflow run.

## Notes
- The app bundles chess.js with Vite, so chess rules work without a CDN connection.
- The Google Fonts import is optional decoration; the game itself does not depend on it.
- The computer opponent uses a small alpha-beta material/position search. It is a casual opponent, not a tournament-strength engine.
