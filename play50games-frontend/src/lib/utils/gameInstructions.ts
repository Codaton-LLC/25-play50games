import { KeyboardControl, MouseControl } from "@/components/GameEngine/KeyboardControls";

// Game instructions and descriptions for each game type
export const gameInstructions: Record<string, {
  description: string;
  instructions: string;
  tips?: string;
  keyboardControls?: KeyboardControl[];
  mouseControls?: MouseControl[];
}> = {
  // Logic Games
  'match-shapes': {
    description: 'Match shapes to their correct outlines',
    instructions: 'Look at the target shape at the top and click the matching shape from the options below.',
    tips: 'Pay attention to the shape details - circles, squares, and triangles can look similar!',
    mouseControls: [
      { action: 'Click', label: 'Click on the matching shape from the options below' },
    ],
    keyboardControls: [
      { keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], label: 'Select shape 1-9' },
      { keys: ['0'], label: 'Select shape 10' },
      { keys: ['-'], label: 'Select shape 11' },
      { keys: ['='], label: 'Select shape 12' },
    ],
  },
  'color-sequence': {
    description: 'Repeat an increasing color pattern',
    instructions: 'Watch the color sequence carefully, then repeat it by clicking the colors in the same order. The sequence gets longer each round!',
    tips: 'Focus on the order, not just the colors. Start from the first color and work your way through.',
    mouseControls: [
      { action: 'Click', label: 'Click colors in the same order as shown' },
    ],
    keyboardControls: [
      { keys: ['1'], label: 'Select color 1 (Red)' },
      { keys: ['2'], label: 'Select color 2 (Blue)' },
      { keys: ['3'], label: 'Select color 3 (Green)' },
      { keys: ['4'], label: 'Select color 4 (Yellow)' },
    ],
  },
  'number-order': {
    description: 'Sort numbers from smallest to largest',
    instructions: 'Click the numbers in order from smallest to largest. Start with 1, then 2, then 3, and so on. Rounds 1-5: 3 numbers, Rounds 6-10: 5 numbers, Rounds 11-20: 10 numbers.',
    tips: 'Take your time to find the smallest number first, then work your way up.',
    mouseControls: [
      { action: 'Click', label: 'Click numbers in order from smallest to largest' },
      { action: 'Click', label: 'Click "Undo" button to remove last selected number' },
    ],
    keyboardControls: [
      { keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], label: 'Select by position (1-9). Press "1" for first number in grid, "2" for second number in grid.' },
      { keys: ['0'], label: 'Select 10th position (if 10 numbers)' },
      { keys: ['Backspace', 'Delete'], label: 'Remove last selected number (undo)' },
    ],
  },
  'find-odd-one': {
    description: 'Identify the icon that\'s different',
    instructions: 'Look at the grid of icons. One icon is different from all the others. Click on the odd one out! Rounds 1-5: 10 icons, Rounds 6-10: 30 icons, Rounds 11-20: 50 icons.',
    tips: 'Most icons will be the same - look for the one that doesn\'t match the pattern. Take your time to scan through all icons.',
    mouseControls: [
      { action: 'Click', label: 'Click on the icon that is different from the others' },
    ],
  },
  'tile-slider': {
    description: 'Rearrange tiles into correct order',
    instructions: 'Your goal: Arrange numbers 1-8 in order from left to right, top to bottom. The empty space (sparkle icon) is where tiles can move. Click on any tile that is next to the empty space (above, below, left, or right) to slide it into the empty spot. The fewer moves you use, the higher your score!',
    tips: 'Look for tiles with a green glow - these can be moved! Work on getting the first row (1, 2, 3) correct first, then the second row (4, 5, 6), and finally the last row (7, 8). Plan your moves ahead - think about which tile you want to move next!',
    mouseControls: [
      { action: 'Click', label: 'Click on tiles that are next to the empty space (they will have a green glow) to move them' },
    ],
    keyboardControls: [
      { keys: ['Tab'], label: 'Select next tile (cycle through tiles)' },
      { keys: ['ArrowUp', 'W'], label: 'Move selected tile up (or move tile below empty space if no selection)' },
      { keys: ['ArrowDown', 'S'], label: 'Move selected tile down (or move tile above empty space if no selection)' },
      { keys: ['ArrowLeft', 'A'], label: 'Move selected tile left (or move tile right of empty space if no selection)' },
      { keys: ['ArrowRight', 'D'], label: 'Move selected tile right (or move tile left of empty space if no selection)' },
    ],
  },
  'balance-scale': {
    description: 'Determine which side of the scale is heavier',
    instructions: 'Look at the weights on both sides of the scale. Choose if the left side is heavier, right side is heavier, or if they are equal.',
    tips: 'Compare the numbers on each side. The larger number means that side is heavier.',
    mouseControls: [
      { action: 'Click', label: 'Click buttons to select: Left is Heavier, Right is Heavier, or Equal' },
    ],
    keyboardControls: [
      { keys: ['ArrowLeft', 'A'], label: 'Left is Heavier' },
      { keys: ['ArrowRight', 'D'], label: 'Right is Heavier' },
      { keys: ['Enter', 'E', ' '], label: 'Equal' },
    ],
  },
  'light-switch': {
    description: 'Connect nodes to complete the circuit path',
    instructions: 'Click nodes to create a path from the Start node (green) to the End node (red). You must click adjacent nodes (up, down, left, right) to form a continuous path. Each round is independent with a new random puzzle!',
    tips: 'Start from the green Start node and click adjacent nodes to build your path. You can backtrack by clicking a node that\'s already in your path. Plan your route to reach the red End node!',
    mouseControls: [
      { action: 'Click', label: 'Click on nodes to build a path from Start (green) to End (red). Nodes must be adjacent (up, down, left, right).' },
    ],
    keyboardControls: [
      { keys: ['ArrowUp', 'W'], label: 'Move selection up' },
      { keys: ['ArrowDown', 'S'], label: 'Move selection down' },
      { keys: ['ArrowLeft', 'A'], label: 'Move selection left' },
      { keys: ['ArrowRight', 'D'], label: 'Move selection right' },
      { keys: ['Enter', 'Space', 'E'], label: 'Add selected node to path (or remove if already in path)' },
    ],
  },
  'circuit-path': {
    description: 'Connect nodes to complete the circuit path',
    instructions: 'Click nodes to create a path from the Start node (green) to the End node (red). You must click adjacent nodes (up, down, left, right) to form a continuous path. Each round is independent with a new random puzzle!',
    tips: 'Start from the green Start node and click adjacent nodes to build your path. You can backtrack by clicking a node that\'s already in your path. Plan your route to reach the red End node!',
    mouseControls: [
      { action: 'Click', label: 'Click on nodes to build a path from Start (green) to End (red). Nodes must be adjacent (up, down, left, right).' },
    ],
    keyboardControls: [
      { keys: ['ArrowUp', 'W'], label: 'Move selection up' },
      { keys: ['ArrowDown', 'S'], label: 'Move selection down' },
      { keys: ['ArrowLeft', 'A'], label: 'Move selection left' },
      { keys: ['ArrowRight', 'D'], label: 'Move selection right' },
      { keys: ['Enter', 'Space', 'E'], label: 'Add selected node to path (or remove if already in path)' },
    ],
  },
  'maze-escape': {
    description: 'Navigate from start to exit through a maze',
    instructions: 'Use arrow keys or WASD to move your character through the maze to reach the exit. You can also click on adjacent cells to move. Avoid walls (black tiles). Each round has a new randomly generated maze. Grid size can be configured in game config, or increases dynamically with rounds: 10x10 (rounds 1-5), 20x20 (rounds 6-15), 45x45 (rounds 16-20).',
    tips: 'Plan your path before moving. Look for the shortest route to the exit. Fewer moves = higher score! Click on adjacent cells to move with mouse.',
    mouseControls: [
      { action: 'Click', label: 'Click on adjacent cells to move your character' },
    ],
    keyboardControls: [
      { keys: ['ArrowUp', 'W'], label: 'Move up' },
      { keys: ['ArrowDown', 'S'], label: 'Move down' },
      { keys: ['ArrowLeft', 'A'], label: 'Move left' },
      { keys: ['ArrowRight', 'D'], label: 'Move right' },
    ],
  },
  'pattern-completion': {
    description: 'Complete the missing pattern element',
    instructions: 'Look at the pattern sequence. One element is missing (shown as ?). Choose the correct shape to complete the pattern. Pattern length increases with rounds: 4 shapes (rounds 1-5), 8 shapes (rounds 6-10), 12 shapes (rounds 11+). You have 20 rounds to complete as many patterns as possible. Each correct answer gives you 5 points (max 100 points).',
    tips: 'Identify the pattern rule - it could be repeating, alternating, or following a sequence. Look for the missing element that fits the pattern. For longer patterns, look for repeating sequences or common elements.',
    mouseControls: [
      { action: 'Click', label: 'Click on the shape that completes the pattern' },
    ],
    keyboardControls: [
      { keys: ['1'], label: 'Select option 1' },
      { keys: ['2'], label: 'Select option 2' },
      { keys: ['3'], label: 'Select option 3' },
      { keys: ['4'], label: 'Select option 4' },
    ],
  },
  'sudoku-4x4': {
    description: 'Fill the 4x4 grid with numbers 1-4',
    instructions: 'Click an empty cell, then select a number (1-4). Each row, column, and 2x2 box must contain numbers 1-4 without repetition.',
    tips: 'Start with cells that have only one possible number. Use the given numbers as clues.',
    mouseControls: [
      { action: 'Click', label: 'Click empty cells to select them' },
      { action: 'Click', label: 'Click number pad (1-4) to enter number' },
    ],
    keyboardControls: [
      { keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'], label: 'Navigate between cells' },
      { keys: ['1', '2', '3', '4'], label: 'Enter number directly' },
      { keys: ['Backspace', 'Delete'], label: 'Clear selected cell' },
    ],
  },
  'rotate-to-fit': {
    description: 'Rotate multiple objects to match their target orientations',
    instructions: 'Each round presents multiple objects (3-5 depending on round). Each object has a target rotation. Rotate each object using its individual buttons to match the target orientation. Round completes when all objects match their target rotations. You have 20 rounds. Each correct round gives you 5 points (max 100 points).',
    tips: 'Select an object first (Tab or number keys 1-5), then use arrow keys or WASD to rotate it. Objects that are already correct cannot be rotated further.',
    mouseControls: [
      { action: 'Click', label: 'Click rotation buttons (Left 90°, Right 90°, Left 180°, Right 180°) for each object' },
    ],
    keyboardControls: [
      { keys: ['Tab'], label: 'Cycle through objects to select' },
      { keys: ['1', '2', '3', '4', '5'], label: 'Select object directly by number' },
      { keys: ['←', 'A'], label: 'Rotate selected object Left 90°' },
      { keys: ['→', 'D'], label: 'Rotate selected object Right 90°' },
      { keys: ['↑', 'W'], label: 'Rotate selected object Left 180°' },
      { keys: ['↓', 'S'], label: 'Rotate selected object Right 180°' },
    ],
  },
  'mirror-match': {
    description: 'Find the correct mirror image of the main shape',
    instructions: 'Each round shows a main shape and a mirror type (horizontal, vertical, or diagonal). Find the correct mirrored version among the options. Click on the option that matches the mirror transformation. You have 20 rounds. Each correct answer gives you 5 points (max 100 points).',
    tips: 'Horizontal mirror flips left-right. Vertical mirror flips top-bottom. Diagonal mirror flips both. Pay attention to the mirror type shown above the main shape.',
    mouseControls: [
      { action: 'Click', label: 'Click on the option that shows the correct mirror image' },
    ],
    keyboardControls: [
      { keys: ['1', '2', '3'], label: 'Select option directly by number' },
    ],
  },
  'logic-gates': {
    description: 'Determine output of logic gates (AND, OR, NOT)',
    instructions: 'Look at the inputs (0 or 1) and the gate type (AND, OR, or NOT). Calculate the correct output and select it. When output is 1, the lamp lights up!',
    tips: 'AND gate: output is 1 only if both inputs are 1. OR gate: output is 1 if at least one input is 1. NOT gate: output is the opposite of the input (0 becomes 1, 1 becomes 0).',
    mouseControls: [
      { action: 'Click', label: 'Click on 0 or 1 to select the output' },
    ],
    keyboardControls: [
      { keys: ['0'], label: 'Select output 0' },
      { keys: ['1'], label: 'Select output 1' },
    ],
  },
  'sequence-arrows': {
    description: 'Predict the next arrow in a sequence',
    instructions: 'You will see a sequence of arrows (↑ ↓ ← →) with one missing arrow shown as "?". Your task is to predict which arrow should come next. Look for patterns like clockwise rotation, repeating sequences, or directional logic. Click on the correct arrow from the 4 options, or use keyboard keys. Each correct answer gives you 5 points. The game has 20 rounds, and the sequence length increases as you progress.',
    tips: 'Look for repeating patterns or sequences. The pattern might be directional (clockwise/counterclockwise), rotational, or follow a specific logic. Pay attention to the sequence length - it increases with each round!',
    mouseControls: [
      { action: 'Click', label: 'Click on the arrow option (1-4) that completes the sequence' },
    ],
    keyboardControls: [
      { keys: ['1', '2', '3', '4'], label: 'Select arrow option directly by number' },
      { keys: ['W', 'A', 'S', 'D'], label: 'Select arrow by direction: W=↑, S=↓, A=←, D=→' },
      { keys: ['Arrow Up', 'Arrow Down', 'Arrow Left', 'Arrow Right'], label: 'Select arrow by direction: ↑ ↓ ← →' },
    ],
  },
  'block-fill': {
    description: 'Fill the grid with all blocks using polyomino pieces',
    instructions: 'Select a piece from the panel, rotate it if needed (R key), and place it on the grid by clicking an empty cell. Click a filled cell to remove that piece. Fill the entire grid using all pieces exactly once. Levels: 3x3, 4x4, 5x5, 6x6, 7x7.',
    tips: 'Start with larger pieces first. Build from corners and edges. Use rotation to fit pieces better. If stuck, remove pieces and try different placements.',
    mouseControls: [
      { action: 'Click', label: 'Click on a piece from the right panel to select it' },
      { action: 'Click', label: 'Click on an empty grid cell to place the selected piece' },
      { action: 'Click', label: 'Click on a filled cell to remove that piece' },
      { action: 'Hover', label: 'Hover over grid to see ghost preview (blue = valid, red = invalid)' },
      { action: 'Click', label: 'Click "Rotate" button to rotate selected piece' },
      { action: 'Click', label: 'Click "Undo" button to remove last placed piece' },
    ],
    keyboardControls: [
      { keys: ['R'], label: 'Rotate the selected piece' },
      { keys: ['U'], label: 'Undo last placement' },
      { keys: ['ESC'], label: 'Deselect current piece' },
    ],
  },
  
  // Memory Games
  'card-flip': {
    description: 'Match pairs of cards by remembering their positions',
    instructions: 'Click cards to flip them and reveal their numbers. Match pairs of identical numbers. Remember where each card is! Grid size increases each round: Round 1 = 3x3, Round 2 = 4x4, Round 3 = 6x6, Round 4 = 8x8, Round 5 = 10x10. You have 5 rounds. Each round gives 20 points (max 100 points).',
    tips: 'Try to remember the positions of cards you\'ve already seen. Focus on finding pairs systematically. Start with the corners and edges, then work your way inward. The larger grids require better memory!',
    mouseControls: [
      { action: 'Click', label: 'Click on a card to flip it and reveal its number' },
      { action: 'Click', label: 'Click on two cards to try to match them' },
    ],
  },
  'sound-memory': {
    description: 'Repeat a sequence of sounds',
    instructions: 'Listen to the sequence of sounds, then repeat it by clicking the sound buttons (or pressing keys 1-4) in the same order. Each round adds one more sound to the sequence. You have 10 rounds. Each round gives 10 points (max 100 points). Use the Replay button to hear the sequence again, and the Hint button (5 uses) to get help with the first sound. Share the game to get unlimited hints!',
    tips: 'Pay attention to the rhythm and order. Try to remember the pattern, not just individual sounds. Use keyboard keys 1-4 for faster gameplay!',
    keyboardControls: [
      { keys: ['1'], label: 'Play sound 1' },
      { keys: ['2'], label: 'Play sound 2' },
      { keys: ['3'], label: 'Play sound 3' },
      { keys: ['4'], label: 'Play sound 4' },
    ],
    mouseControls: [
      { action: 'Click', label: 'Click on a sound pad to play that sound' },
      { action: 'Click', label: 'Click Replay to hear the sequence again' },
      { action: 'Click', label: 'Click Hint to get help with the first sound (5 uses)' },
      { action: 'Click', label: 'Click Share to get unlimited hints when someone opens your link' },
    ],
  },
  'emoji-memory': {
    description: 'Remember emoji positions on a grid',
    instructions: 'Memorize the positions of emojis on the grid. After they disappear, click on the cells where you saw each emoji in the correct order.',
    tips: 'Create a mental map of the grid. Associate each emoji with its position. Start with the corners and edges to build your spatial memory.',
    mouseControls: [
      { action: 'Click', label: 'Click on cells where you saw emojis to select them' }
    ]
  },
  'number-recall': {
    description: 'Remember and type a number sequence',
    instructions: 'Watch the numbers appear on screen. After they disappear, type the sequence you saw in the correct order.',
    tips: 'Break long sequences into smaller chunks. Remember groups of 2-3 numbers at a time.',
    mouseControls: [
      { action: 'Type', label: 'Type the number sequence in the input field' },
      { action: 'Click', label: 'Click "OK" button to submit your answer' }
    ],
    keyboardControls: [
      { keys: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], label: 'Type numbers 0-9 to enter the sequence' },
      { keys: ['Enter'], label: 'Press Enter to submit your answer' }
    ]
  },
  'image-recall': {
    description: 'Remember image order',
    instructions: 'Watch the sequence of images flash on the grid. After they disappear, click on the images in the same order you saw them. The sequence gets longer each round!',
    tips: 'Create a story or association to remember the order. Visualize the sequence as a story. Focus on order and positions.',
    mouseControls: [
      { action: 'Click', label: 'Click images in the same order as shown' },
    ],
    keyboardControls: [
      { keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], label: 'Select image by position (1-9). Press "1" for first image in grid, "2" for second image in grid.' },
      { keys: ['0'], label: 'Select 10th position (if grid has 10+ images)' },
      { keys: ['-'], label: 'Select 11th position (if grid has 11+ images)' },
      { keys: ['='], label: 'Select 12th position (if grid has 12+ images)' },
      { keys: ['Arrow Up', 'Arrow Down', 'Arrow Left', 'Arrow Right'], label: 'Navigate through grid cells' },
      { keys: ['W', 'A', 'S', 'D'], label: 'Navigate through grid cells (W=Up, S=Down, A=Left, D=Right)' },
      { keys: ['Enter', 'Space'], label: 'Select currently highlighted cell' },
    ],
  },
  'path-memory': {
    description: 'Recreate a path on a grid',
    instructions: 'Watch the path that lights up on the grid. After it disappears, click on the cells to recreate the same path in the same order. The path length increases with each round!',
    tips: 'Remember the starting point. Follow the direction of movement step by step. Create a mental map of the path sequence.',
    mouseControls: [
      { action: 'Click', label: 'Click cells in the same order as the path that was shown' },
    ],
    keyboardControls: [
      { keys: ['ArrowUp', 'W'], label: 'Move selection Up' },
      { keys: ['ArrowDown', 'S'], label: 'Move selection Down' },
      { keys: ['ArrowLeft', 'A'], label: 'Move selection Left' },
      { keys: ['ArrowRight', 'D'], label: 'Move selection Right' },
      { keys: ['Enter', 'Space'], label: 'Select highlighted cell' },
    ],
  },
  'word-memory': {
    description: 'Remember and click words in sequence',
    instructions: 'Watch the words flash on the grid one by one. After they disappear, click on the words in the same order they appeared. The sequence length increases with each round!',
    tips: 'Remember the starting word. Follow the sequence step by step. Create a mental story or association to remember the order.',
    mouseControls: [
      { action: 'Click', label: 'Click words in the same order as they flashed' },
    ],
    keyboardControls: [
      { keys: ['1-9', '0', '-', '='], label: 'Select words by position in grid (1-12)' },
      { keys: ['ArrowUp', 'W'], label: 'Move selection Up' },
      { keys: ['ArrowDown', 'S'], label: 'Move selection Down' },
      { keys: ['ArrowLeft', 'A'], label: 'Move selection Left' },
      { keys: ['ArrowRight', 'D'], label: 'Move selection Right' },
      { keys: ['Enter', 'Space'], label: 'Select highlighted word' },
    ],
  },
  'face-memory': {
    description: 'Match faces with names',
    instructions: 'Study the faces and their names. After they disappear, match each face with its correct name. The number of faces increases with each round (3-6 faces).',
    tips: 'Look for distinctive features on each face. Associate names with facial characteristics.',
    mouseControls: [
      { action: 'Click', label: 'Click on a face to select it' },
      { action: 'Click', label: 'Click on a name button to match it with the selected face' },
      { action: 'Click', label: 'Click Hint button to reveal a face name (10 uses, unlimited if shared)' },
      { action: 'Click', label: 'Click Share button to get unlimited hints when someone opens your link' },
    ],
    keyboardControls: [
      { keys: ['1', '2', '3', '4', '5', '6'], label: 'Select face by number (1-6)' },
      { keys: ['ArrowUp', 'W'], label: 'Move selection up' },
      { keys: ['ArrowDown', 'S'], label: 'Move selection down' },
      { keys: ['1', '2', '3', '4', '5', '6'], label: 'Select name for current face by number' },
      { keys: ['Enter', 'Space'], label: 'Cycle through available names for selected face' },
    ],
  },
  'color-grid-memory': {
    description: 'Memorize and reproduce color sequences on a grid',
    instructions: 'Watch the colored cells flash on the grid one by one. After the sequence finishes, click the cells in the same order they appeared. The grid size and sequence length increase with each round.',
    tips: 'Focus on the order of cells, not just which cells were highlighted. Try to visualize the pattern as a path. Group cells mentally to remember longer sequences.',
    mouseControls: [
      { action: 'Click', label: 'Click on cells in the same order they appeared' },
      { action: 'Click', label: 'Click Hint button to reveal the next correct cell (10 uses, unlimited if shared)' },
      { action: 'Click', label: 'Click Share button to get unlimited hints when someone opens your link' },
    ],
    keyboardControls: [
      { keys: ['1-9', '0', '-', '='], label: 'Select cells by position in grid (1-12)' },
      { keys: ['ArrowUp', 'W'], label: 'Move selection Up' },
      { keys: ['ArrowDown', 'S'], label: 'Move selection Down' },
      { keys: ['ArrowLeft', 'A'], label: 'Move selection Left' },
      { keys: ['ArrowRight', 'D'], label: 'Move selection Right' },
      { keys: ['Enter', 'Space'], label: 'Select highlighted cell' },
    ],
  },
  'symbol-stack': {
    description: 'Watch symbols stack up one by one and rebuild the stack from bottom to top',
    instructions: 'Watch the symbols appear one by one, stacking from bottom to top. After the sequence finishes, click the symbols in the same order they appeared to rebuild the stack. The sequence length increases with each round.',
    tips: 'Think bottom → top. Create a visual story to remember the order. Focus on the sequence, not just which symbols appeared.',
    mouseControls: [
      { action: 'Click', label: 'Click on symbols in the same order they appeared (bottom to top)' },
      { action: 'Click', label: 'Click Hint button to reveal the next correct symbol (10 uses, unlimited if shared)' },
      { action: 'Click', label: 'Click Share button to get unlimited hints when someone opens your link' },
    ],
    keyboardControls: [
      { keys: ['1-3'], label: 'Select symbols by position in palette (1-3)' },
      { keys: ['ArrowUp', 'W'], label: 'Move selection Up' },
      { keys: ['ArrowDown', 'S'], label: 'Move selection Down' },
      { keys: ['ArrowLeft', 'A'], label: 'Move selection Left' },
      { keys: ['ArrowRight', 'D'], label: 'Move selection Right' },
      { keys: ['Enter', 'Space'], label: 'Select highlighted symbol' },
    ],
  },
  
  // Speed Games
  'click-green': {
    description: 'Click only green items quickly. Avoid red items!',
    instructions: 'Green and red items will appear on screen. Click ONLY on the green items (✓) as fast as you can. Avoid clicking red items (✕) or you\'ll lose points! Each level lasts 20 seconds. The game gets faster with each level.',
    tips: 'Stay focused and react quickly. Don\'t click too fast or you might hit a red item by mistake. Items disappear after a short time, so be quick but accurate.',
    mouseControls: [
      { action: 'Click', label: 'Click on green items (✓) to score points' },
      { action: 'Avoid', label: 'Avoid clicking red items (✕) or you\'ll lose points' },
    ],
  },
  'avoid-red': {
    description: 'Avoid red obstacles for set duration',
    instructions: 'Move your cursor to control the blue dot. Avoid red obstacles for the full duration. Keep moving—don\'t let them touch you! Each level has its own survival time requirement. The game gets faster with each level. Share the game to unlock unlimited hits!',
    tips: 'Keep your cursor moving. Watch for red items coming from all directions. Red obstacles will home in on your position, so constant movement is key! Share the game to unlock unlimited hits and make it easier.',
    mouseControls: [
      { action: 'Move', label: 'Move cursor to control player position' },
    ],
  },
  'reaction-test': {
    description: 'Test your reaction time with 10 unique mini-games',
    instructions: '<p>Test your reaction speed across 10 different challenging mini-games. Each level is completely unique!</p><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">HOW TO PLAY:</h4><ol style="margin-left: 20px; margin-bottom: 16px;"><li>Wait for the signal (green color, matching shape, countdown end, etc.)</li><li>Click as fast as possible when you see the signal</li><li>Avoid early clicks - they are penalized</li><li>Complete all 10 levels to finish the game</li></ol><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">LEVEL BREAKDOWN:</h4><ol style="margin-left: 20px; margin-bottom: 16px;"><li><strong>Color Flash</strong> - Watch colors change, click when green appears</li><li><strong>Moving Target</strong> - Follow a moving target, click when it turns green</li><li><strong>Countdown</strong> - Wait for "3...2...1...GO!", then click immediately</li><li><strong>Shape Match</strong> - Match the target shape, click when shapes match</li><li><strong>Speed Reaction</strong> - Multiple moving objects, click green ones quickly</li><li><strong>Pattern Reaction</strong> - Watch color pattern sequence, click when green</li><li><strong>Multi-Target</strong> - Multiple targets appear, click only green ones</li><li><strong>Timing Reaction</strong> - Progress bar fills up, click at 100%</li><li><strong>Memory Reaction</strong> - Remember number sequence, click when ready</li><li><strong>Master Reaction</strong> - Ultimate challenge with random delays and short windows</li></ol><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">EXAMPLE ROUND (Color Flash Reaction - Level 1):</h4><ol style="margin-left: 20px; margin-bottom: 16px;"><li>Four colored circles appear on screen (red, blue, orange, green)</li><li>Colors flash in random sequence - watch carefully!</li><li>When the <strong style="color: #22c55e;">green circle</strong> lights up - click immediately!</li><li>Your reaction time is measured in milliseconds</li><li>Faster clicks = better score! Early clicks are penalized.</li></ol><p style="margin-top: 8px;"><strong>Tip:</strong> Each mini-game has different mechanics. Pay attention to the variant name at the top of each level!</p>',
    tips: 'Stay focused and wait for the correct signal. Don\'t click too early or you\'ll get penalties. Each mini-game is unique - read the variant name and watch for visual cues. Practice makes perfect!',
    mouseControls: [
      { action: 'Click', label: 'Click when you see the green signal or correct match' },
      { action: 'Wait', label: 'Wait for the signal - early clicks are penalized' },
      { action: 'Observe', label: 'Watch the screen carefully - each mini-game has different mechanics' },
    ],
  },
  'fast-math': {
    description: 'Solve math problems quickly across 20 levels. Progressive difficulty with addition, subtraction, multiplication, and division.',
    instructions: '<p>Solve math problems as quickly as possible by selecting the correct answer from 4 options. Each level has a time limit and requires a minimum number of correct answers to pass.</p><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">HOW TO PLAY:</h4><ol style="margin-left: 20px; margin-bottom: 16px;"><li>A math problem appears at the top (e.g., "5 + 3 = ?")</li><li>Four answer options appear below in buttons with numbered badges (1-4)</li><li>Click the button with the correct answer, or press <strong style="color: #3b82f6;">1, 2, 3, or 4</strong> on your keyboard</li><li>Each button shows a blue number badge in the corner matching the keyboard shortcut</li><li>Answer correctly as many times as possible within the time limit</li><li>Complete the minimum required correct answers to pass the level</li></ol><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">EXAMPLE ROUND (Level 1 - Addition):</h4><div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05)); border: 2px solid rgba(59, 130, 246, 0.3); border-radius: 12px; padding: 16px; margin: 12px 0;"><div style="font-size: 1.1rem; font-weight: 700; margin-bottom: 12px; color: var(--text);">Problem appears:</div><div style="font-size: 2rem; font-weight: 800; text-align: center; margin: 16px 0; color: var(--text); font-family: monospace;">7 × 4 = ?</div><div style="font-size: 1rem; font-weight: 600; margin-bottom: 12px; color: var(--text);">Four answer buttons appear:</div><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0;"><div style="background: rgba(59, 130, 246, 0.15); border: 2px solid rgba(59, 130, 246, 0.5); border-radius: 8px; padding: 12px; text-align: center;"><div style="display: inline-block; background: rgba(59, 130, 246, 0.8); color: white; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; margin-bottom: 8px;">1</div><div style="font-size: 1.5rem; font-weight: 700; font-family: monospace;">28</div></div><div style="background: rgba(100, 100, 100, 0.1); border: 2px solid rgba(100, 100, 100, 0.3); border-radius: 8px; padding: 12px; text-align: center;"><div style="display: inline-block; background: rgba(100, 100, 100, 0.4); color: white; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; margin-bottom: 8px;">2</div><div style="font-size: 1.5rem; font-weight: 700; font-family: monospace;">24</div></div><div style="background: rgba(100, 100, 100, 0.1); border: 2px solid rgba(100, 100, 100, 0.3); border-radius: 8px; padding: 12px; text-align: center;"><div style="display: inline-block; background: rgba(100, 100, 100, 0.4); color: white; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; margin-bottom: 8px;">3</div><div style="font-size: 1.5rem; font-weight: 700; font-family: monospace;">32</div></div><div style="background: rgba(100, 100, 100, 0.1); border: 2px solid rgba(100, 100, 100, 0.3); border-radius: 8px; padding: 12px; text-align: center;"><div style="display: inline-block; background: rgba(100, 100, 100, 0.4); color: white; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; margin-bottom: 8px;">4</div><div style="font-size: 1.5rem; font-weight: 700; font-family: monospace;">21</div></div></div><div style="margin-top: 16px; padding: 12px; background: rgba(34, 197, 94, 0.15); border-left: 4px solid #22c55e; border-radius: 6px;"><strong style="color: #22c55e;">✓ Correct Action:</strong> Click button <strong style="color: #3b82f6;">[1]</strong> or press <strong style="color: #3b82f6;">1</strong> on keyboard (answer: 28)</div><div style="margin-top: 12px; font-size: 0.95rem; color: var(--muted);">New problem appears immediately after answering. Continue until time runs out or you reach the required correct answers!</div></div><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">LEVEL PROGRESSION:</h4><ul style="margin-left: 20px; margin-bottom: 16px;"><li><strong style="color: #3b82f6;">Levels 1-5:</strong> Simple addition/subtraction (1-20)</li><li><strong style="color: #3b82f6;">Levels 6-10:</strong> Addition/subtraction (1-50), introduce multiplication</li><li><strong style="color: #3b82f6;">Levels 11-15:</strong> All operations, larger numbers</li><li><strong style="color: #3b82f6;">Levels 16-20:</strong> All operations including division, complex numbers</li></ul>',
    tips: 'Use keyboard shortcuts (1-4) for faster answers. Practice mental math. For division, answers may have decimals. Negative results are possible in subtraction.',
    keyboardControls: [
      { keys: ['1'], label: 'Select answer option 1 (top-left)' },
      { keys: ['2'], label: 'Select answer option 2 (top-right)' },
      { keys: ['3'], label: 'Select answer option 3 (bottom-left)' },
      { keys: ['4'], label: 'Select answer option 4 (bottom-right)' },
    ],
    mouseControls: [
      { action: 'Click', label: 'Click on the button with the correct answer' },
      { action: 'Number Indicator', label: 'Each button shows its number (1-4) for keyboard shortcuts' },
    ],
  },
  'whack-shape': {
    description: 'Click the correct shape type quickly across 10 levels. Progressive difficulty with faster spawning and shorter display times.',
    instructions: '<p>Click shapes that match the target type (circle, square, or triangle) as quickly as possible. Each level has a time limit and requires a minimum number of correct clicks to pass.</p><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">HOW TO PLAY:</h4><ol style="margin-left: 20px; margin-bottom: 16px;"><li>A target shape is displayed at the top (circle, square, or triangle)</li><li>Shapes spawn randomly in the arena and move around</li><li>Click shapes that match the target type to score correct clicks</li><li>Clicking wrong shapes counts as mistakes</li><li>Shapes disappear after being clicked or after their time expires</li><li>Complete the minimum required correct clicks within the time limit to pass the level</li></ol><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">EXAMPLE ROUND (Level 1 - Target: Circle):</h4><div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05)); border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 12px; padding: 20px; margin-bottom: 20px; display: flex; flex-direction: column; align-items: center; gap: 20px;"><div style="width: 100%; text-align: center; margin-bottom: 12px;"><div style="display: inline-flex; align-items: center; gap: 12px; padding: 12px 24px; background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1)); border: 2px solid rgba(59, 130, 246, 0.6); border-radius: 12px; font-size: 1.2rem; font-weight: 700; color: var(--text);"><span>Click the</span><div style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;"><div style="width: 100%; height: 100%; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #2563eb); border: 2px solid rgba(255, 255, 255, 0.3);"></div></div><span>shape!</span></div></div><div style="position: relative; width: 100%; max-width: 400px; height: 250px; background: var(--card); border: 1px solid var(--stroke); border-radius: 12px; overflow: hidden; margin: 12px 0;"><div style="position: absolute; top: 20px; left: 30px; width: 54px; height: 54px; cursor: pointer;"><div style="width: 100%; height: 100%; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #2563eb); border: 2px solid rgba(255, 255, 255, 0.3); box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);"></div></div><div style="position: absolute; top: 60px; right: 50px; width: 54px; height: 54px; cursor: pointer;"><div style="width: 100%; height: 100%; background: linear-gradient(135deg, #3b82f6, #2563eb); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);"></div></div><div style="position: absolute; bottom: 40px; left: 80px; width: 54px; height: 54px; cursor: pointer;"><div style="width: 0; height: 0; border-left: 27px solid transparent; border-right: 27px solid transparent; border-bottom: 47px solid #3b82f6; filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));"></div></div><div style="position: absolute; bottom: 80px; right: 30px; width: 54px; height: 54px; cursor: pointer;"><div style="width: 100%; height: 100%; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #2563eb); border: 2px solid rgba(255, 255, 255, 0.3); box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);"></div></div></div><div style="display: flex; align-items: center; gap: 8px; padding: 12px 20px; background: linear-gradient(135deg, rgba(134, 239, 172, 0.2), rgba(134, 239, 172, 0.1)); border: 2px solid rgba(134, 239, 172, 0.6); border-radius: var(--radius); color: var(--ok); font-size: 1rem; font-weight: 600; width: 100%; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>Correct! +1</div><div style="display: flex; align-items: center; gap: 8px; padding: 12px 20px; background: linear-gradient(135deg, rgba(252, 165, 165, 0.2), rgba(252, 165, 165, 0.1)); border: 2px solid rgba(252, 165, 165, 0.6); border-radius: var(--radius); color: var(--warn); font-size: 1rem; font-weight: 600; width: 100%; justify-content: center; margin-top: 8px;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>Mistake! -1</div><p style="font-size: 0.9rem; opacity: 0.8; text-align: center; margin-top: 10px;">Click the <strong style="color: #3b82f6;">circle</strong> shapes (target). Avoid clicking squares and triangles!</p></div><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">LEVEL PROGRESSION:</h4><ul style="margin-left: 20px; margin-bottom: 16px;"><li><strong>Levels 1-3:</strong> Slower spawn rate (800ms), longer display time (2500ms), easier movement</li><li><strong>Levels 4-6:</strong> Medium spawn rate (600ms), medium display time (2000ms), faster movement</li><li><strong>Levels 7-10:</strong> Fast spawn rate (300-400ms), short display time (1000-1500ms), very fast movement</li></ul><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">SHAPE TYPES:</h4><ul style="margin-left: 20px; margin-bottom: 16px;"><li><strong>Circle:</strong> Round shape with smooth edges</li><li><strong>Square:</strong> Four equal sides with sharp corners</li><li><strong>Triangle:</strong> Three-sided shape pointing upward</li></ul>',
    tips: 'Focus on the target shape type shown at the top. Click quickly but accurately to avoid mistakes. Watch for shapes that match the target type. Higher levels require faster reactions due to increased spawn rate and movement speed. Use replays strategically when you\'re close to meeting the requirement.',
    mouseControls: [
      { action: 'Click', label: 'Click on shapes that match the target type (circle, square, or triangle)' },
      { action: 'Avoid', label: 'Avoid clicking shapes that don\'t match the target (they count as mistakes)' },
      { action: 'Target Indicator', label: 'Look at the target shape indicator at the top of the game area' },
      { action: 'Quick Reaction', label: 'Click quickly as shapes move around the arena' },
    ],
  },
  'typing-sprint': {
    description: 'Type words accurately and fast',
    instructions: 'Words will appear on screen. Type them exactly as shown, then press Enter. Type as fast and accurately as possible!',
    tips: 'Accuracy is more important than speed. One mistake can cost you time.'
  },
  'quick-compare': {
    description: 'Compare two numbers quickly',
    instructions: 'Two numbers will appear. Quickly determine which is larger and click the correct button (< or >).',
    tips: 'Compare the numbers quickly. For larger numbers, look at the first digit first.'
  },
  'falling-objects': {
    description: 'Catch good items, avoid bad ones',
    instructions: 'Items will fall from the top. Click on good items to catch them, but avoid clicking bad items!',
    tips: 'Watch the items carefully. Good items are usually marked with a + or green color.'
  },
  'tap-counter': {
    description: 'Tap as many times as possible',
    instructions: 'Tap the button as many times as you can within the time limit. Speed is key!',
    tips: 'Use multiple fingers if possible. Keep a steady rhythm for maximum taps.'
  },
  'reflex-arrows': {
    description: 'Press arrow keys quickly',
    instructions: 'Arrow keys (↑↓←→) will appear on screen. Press the corresponding arrow key on your keyboard as quickly as possible.',
    tips: 'Keep your fingers on the arrow keys. React immediately when you see the direction.'
  },
  
  // Skill Games
  'ball-balance': {
    description: 'Balance a ball on a platform',
    instructions: 'Use your mouse or touch to tilt the platform and keep the ball balanced in the center zone. Don\'t let it fall!',
    tips: 'Make small, gentle movements. Overcorrecting will make the ball fall faster.'
  },
  'target-aim': {
    description: 'Click moving targets with increasing speed',
    instructions: 'Targets will appear and move around the screen. Click on them before they disappear. They move faster as you progress!',
    tips: 'Aim slightly ahead of moving targets. Practice your hand-eye coordination.'
  },
  'line-tracer': {
    description: 'Trace a path with cursor',
    instructions: 'A path will be shown. Trace it exactly with your cursor, staying as close to the line as possible.',
    tips: 'Move slowly and steadily. Don\'t rush - accuracy is more important than speed.'
  },
  'timing-bar': {
    description: 'Stop moving bar at highlighted zone',
    instructions: 'A bar will move back and forth. Click when the bar is in the highlighted zone to stop it.',
    tips: 'Watch the rhythm of the bar. Time your click to match when the bar enters the zone.'
  },
  'stack-blocks': {
    description: 'Stack blocks as evenly as possible',
    instructions: 'Click to drop blocks and stack them. Try to align them perfectly on top of each other.',
    tips: 'Watch the block as it falls. Click when it\'s aligned with the block below.'
  },
  'precision-drop': {
    description: 'Drop object into small target area',
    instructions: 'Position the object above the target, then click to drop it. The target area is small, so precision matters!',
    tips: 'Take your time to aim. Small adjustments can make a big difference.'
  },
  'drag-sort': {
    description: 'Sort items into correct categories',
    instructions: 'Drag items from the center into the correct category boxes. Sort them quickly and accurately!',
    tips: 'Look at the item characteristics. Group similar items together mentally first.'
  },
  'speed-drawing': {
    description: 'Draw displayed shape within time limit',
    instructions: 'A shape will be shown. Draw it as accurately as possible using your mouse or touch before time runs out.',
    tips: 'Start with the basic outline, then add details. Practice makes perfect!'
  },
  'one-hand': {
    description: 'Complete task using only one control',
    instructions: 'Complete the challenge using only one hand or one control method. This tests your coordination!',
    tips: 'Plan your moves. Efficiency is key when you have limited control options.'
  },
  'cursor-maze': {
    description: 'Navigate maze with cursor without touching walls',
    instructions: 'Move your cursor through the maze to reach the exit. Don\'t touch the walls or you\'ll have to start over!',
    tips: 'Move slowly and carefully. Plan your path before moving.'
  },
  
  // Final Games
  'mixed-quiz': {
    description: 'Randomly mix logic, memory, and reaction challenges',
    instructions: 'You\'ll face a mix of different game types. Adapt quickly to each new challenge!',
    tips: 'Stay flexible. Each round is different, so be ready for anything.'
  },
  'survival-mode': {
    description: 'Complete several mini-games in sequence without failing',
    instructions: 'Complete multiple mini-games in a row. If you fail one, you have to start over. Survive as long as you can!',
    tips: 'Take your time with each game. One mistake ends the run, so accuracy is crucial.'
  },
  'boss-puzzle': {
    description: 'Combine multiple mechanics into one difficult puzzle',
    instructions: 'This is the ultimate challenge combining multiple game mechanics. Think carefully and solve the complex puzzle!',
    tips: 'Break the puzzle into smaller parts. Solve each part systematically.'
  },
  'time-challenge': {
    description: 'Complete as many challenges as possible within time limit',
    instructions: 'Complete as many mini-games as you can within the time limit. Speed and accuracy both matter!',
    tips: 'Don\'t spend too much time on one game. Move quickly but accurately.'
  },
  'final-test': {
    description: 'Randomized final exam using previous game mechanics',
    instructions: 'This is your final test! You\'ll face randomized challenges from all previous games. Show what you\'ve learned!',
    tips: 'Remember what you learned in each game type. Stay calm and focused.'
  }
};

// Get instructions for a game
export function getGameInstructions(gameType: string, gameTitle?: string): {
  description: string;
  instructions: string;
  tips?: string;
  keyboardControls?: KeyboardControl[];
  mouseControls?: MouseControl[];
} {
  // Try to find by gameType first
  if (gameInstructions[gameType]) {
    return gameInstructions[gameType];
  }
  
  // Try to find by title (case-insensitive)
  if (gameTitle) {
    const titleLower = gameTitle.toLowerCase();
    for (const [key, value] of Object.entries(gameInstructions)) {
      // Check if title includes the key or key without dashes
      const keyWithoutDashes = key.replace(/-/g, ' ');
      if (titleLower.includes(keyWithoutDashes) || titleLower.includes(key.replace('-', ' ')) || titleLower.includes(key)) {
        return value;
      }
    }
    // Special case for "Rotate to Fit"
    if (titleLower.includes('rotate') && titleLower.includes('fit')) {
      return gameInstructions['rotate-to-fit'];
    }
  }
  
  // Default fallback
  return {
    description: 'Complete the challenge to earn points',
    instructions: 'Follow the on-screen instructions and complete the game within the time limit.',
    tips: 'Read the instructions carefully and take your time.'
  };
}

