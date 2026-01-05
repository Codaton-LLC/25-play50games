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
    description: 'Test your typing speed and accuracy across 15 unique levels',
    instructions: '<p>Type words, sentences, numbers, and special characters as fast and accurately as possible. Each level has different challenges and you must type a minimum number of correct texts within the time limit to pass.</p><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">HOW TO PLAY:</h4><ol style="margin-left: 20px; margin-bottom: 16px;"><li>A word, sentence, number, or special text will appear on screen</li><li>Type it exactly as shown in the input field below</li><li>Characters will highlight in green when correct, red when wrong</li><li>The text will auto-submit when you type it correctly</li><li>Complete the minimum required correct texts within the time limit to pass the level</li><li>Each level has different difficulty and text types</li></ol><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">EXAMPLE ROUND (Level 1 - Simple Words):</h4><div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05)); border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 12px; padding: 20px; margin-bottom: 20px; display: flex; flex-direction: column; align-items: center; gap: 20px;"><div style="width: 100%; text-align: center; margin-bottom: 12px;"><div style="font-size: 1.5rem; font-weight: 800; color: var(--text); padding: 16px; background: var(--card); border: 1px solid var(--stroke); border-radius: 12px; margin-bottom: 16px;">cat</div><div style="width: 100%; padding: 16px; background: var(--background); border: 2px solid var(--stroke); border-radius: 12px; font-size: 1.2rem; font-weight: 600; text-align: center; color: var(--text);">Type here...</div></div><div style="display: flex; align-items: center; gap: 8px; padding: 12px 20px; background: linear-gradient(135deg, rgba(134, 239, 172, 0.2), rgba(134, 239, 172, 0.1)); border: 2px solid rgba(134, 239, 172, 0.6); border-radius: var(--radius); color: var(--ok); font-size: 1rem; font-weight: 600; width: 100%; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>Correct! +1 word</div><p style="font-size: 0.9rem; opacity: 0.8; text-align: center; margin-top: 10px;">Type the word exactly as shown. Characters highlight in <strong style="color: #86efac;">green</strong> when correct, <strong style="color: #fca5a5;">red</strong> when wrong!</p></div><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">LEVEL PROGRESSION:</h4><ul style="margin-left: 20px; margin-bottom: 16px;"><li><strong>Levels 1-3:</strong> Simple words (3-4 letters), easy typing</li><li><strong>Levels 4-6:</strong> Medium words (5-6 letters), words with special characters</li><li><strong>Levels 7-9:</strong> Longer words, sentences, numbers</li><li><strong>Levels 10-12:</strong> Mixed case, special characters, long sentences</li><li><strong>Levels 13-15:</strong> Complex sentences, master challenges</li></ul><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">TEXT TYPES:</h4><ul style="margin-left: 20px; margin-bottom: 16px;"><li><strong>Words:</strong> Simple to complex words of varying lengths</li><li><strong>Sentences:</strong> Full sentences that you must type accurately</li><li><strong>Numbers:</strong> Numeric sequences and calculations</li><li><strong>Special Characters:</strong> Text with symbols like @, #, $, etc.</li><li><strong>Mixed Case:</strong> Text with uppercase and lowercase letters</li><li><strong>Reverse Typing:</strong> Text displayed reversed, type it normally</li></ul>',
    tips: 'Focus on accuracy first, then speed. Watch the character highlighting - green means correct, red means wrong. For sentences, use spaces normally. Press Enter to reset if you make a mistake. Higher levels require faster typing and more complex texts.',
    keyboardControls: [
      { keys: ['Any Letter/Number'], label: 'Type characters to match the displayed text' },
      { keys: ['Space'], label: 'Type spaces for sentences (allowed normally)' },
      { keys: ['Enter'], label: 'Reset input if you made a mistake' },
      { keys: ['Backspace'], label: 'Delete characters to correct mistakes' },
    ],
    mouseControls: [
      { action: 'Click', label: 'Click on the input field to focus and start typing' },
      { action: 'Focus', label: 'The input field auto-focuses when a new text appears' },
    ],
  },
  'quick-compare': {
    description: 'Test your number comparison skills across 15 unique levels',
    instructions: '<p>Compare two numbers quickly and accurately. Each level has different number types and you must make a minimum number of correct comparisons within the time limit to pass.</p><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">HOW TO PLAY:</h4><ol style="margin-left: 20px; margin-bottom: 16px;"><li>Two numbers will appear on screen (left and right)</li><li>Click &lt; if the left number is smaller than the right number</li><li>Click &gt; if the left number is larger than the right number</li><li>You\'ll get immediate feedback (green for correct, red for wrong)</li><li>Complete the minimum required correct comparisons within the time limit to pass the level</li><li>Each level has different number types: integers, decimals, negative numbers, and more</li></ol><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">LEVEL PROGRESSION:</h4><ul style="margin-left: 20px; margin-bottom: 16px;"><li><strong>Levels 1-3:</strong> Simple to larger integers (1-200)</li><li><strong>Levels 4-6:</strong> Large to huge integers (100-10000)</li><li><strong>Levels 7-9:</strong> Decimals with varying precision (0.1-1000)</li><li><strong>Levels 10-12:</strong> Negative numbers and mixed positive/negative (-1000 to 1000)</li><li><strong>Levels 13-15:</strong> Very large numbers, decimals, and master challenge with all types</li></ul>',
    tips: 'For large numbers, compare digit by digit from left to right. For decimals, compare the whole number part first, then the decimal part. For negative numbers, remember that -5 is smaller than -3. Stay focused and react quickly but accurately.',
    keyboardControls: [
      { keys: [','], label: 'Click < button (left is smaller)' },
      { keys: ['.'], label: 'Click > button (left is larger)' },
    ],
    mouseControls: [
      { action: 'Click', label: 'Click < button if left number is smaller' },
      { action: 'Click', label: 'Click > button if left number is larger' },
    ],
  },
  'falling-objects': {
    description: 'Catch good falling objects and avoid bad ones across 15 unique levels',
    instructions: '<p>Objects will fall from the top of the screen. Your task is to catch good objects (stars, hearts, bolts, checkmarks) and avoid bad objects (X marks, fire icons). Each level has different speed, object sizes, and requirements.</p><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">HOW TO PLAY:</h4><ol style="margin-left: 20px; margin-bottom: 16px;"><li>Objects will fall from the top of the screen at different speeds</li><li>Click on good objects (<svg style="display: inline; width: 14px; height: 14px; vertical-align: middle; margin: 0 2px; color: var(--ok);" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg> star, <svg style="display: inline; width: 14px; height: 14px; vertical-align: middle; margin: 0 2px; color: var(--ok);" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" /></svg> heart, <svg style="display: inline; width: 14px; height: 14px; vertical-align: middle; margin: 0 2px; color: var(--ok);" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5 10.5 6.75l6.75 6.75M13.5 6.75v13.5m0-13.5L3.75 13.5l9.75 6.75" /></svg> bolt, <svg style="display: inline; width: 14px; height: 14px; vertical-align: middle; margin: 0 2px; color: var(--ok);" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg> checkmark) to catch them</li><li>Avoid clicking bad objects (<svg style="display: inline; width: 14px; height: 14px; vertical-align: middle; margin: 0 2px; color: var(--warn);" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg> X mark, <svg style="display: inline; width: 14px; height: 14px; vertical-align: middle; margin: 0 2px; color: var(--warn);" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 8.038-3.366M15.362 5.214l-1.359 6.622m0 0-3.833 2.25m3.833-2.25 3.833 2.25M3 20.25v-4.875c0-.621.504-1.125 1.125-1.125h4.875c.621 0 1.125.504 1.125 1.125V20.25M3 20.25h18M3 20.25v-4.875c0-.621.504-1.125 1.125-1.125h4.875c.621 0 1.125.504 1.125 1.125V20.25" /></svg> fire icon)</li><li>Each level requires catching a minimum number of good objects within the time limit</li><li>If a good object reaches the bottom without being caught, it counts as missed</li><li>Difficulty increases with each level: faster falling speed, smaller objects, more bad objects</li></ol><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">LEVEL PROGRESSION:</h4><ul style="margin-left: 20px; margin-bottom: 16px;"><li><strong>Levels 1-3:</strong> Slow falling, large objects, mostly good objects</li><li><strong>Levels 4-6:</strong> Faster speed, smaller objects, more bad objects</li><li><strong>Levels 7-9:</strong> Ultra fast, tiny objects, balanced good/bad ratio</li><li><strong>Levels 10-12:</strong> Extreme speed, rapid spawn, more bad objects</li><li><strong>Levels 13-15:</strong> Maximum difficulty, fastest speed, smallest objects</li></ul>',
    tips: 'Focus on good objects and ignore bad ones. Watch the falling speed - higher levels are much faster. Click accurately to avoid catching bad objects. The objects rotate as they fall, so stay focused. Practice your reaction time and hand-eye coordination.',
    keyboardControls: [],
    mouseControls: [
      { action: 'Click', label: 'Click on good objects to catch them' },
      { action: 'Avoid', label: 'Do NOT click on bad objects' },
    ],
  },
  'tap-counter': {
    description: 'Tap as fast as you can across 15 unique levels',
    instructions: '<p>Tap the large circular button as many times as possible within the time limit. Each level requires a minimum number of taps to pass, and the requirements increase with each level.</p><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">HOW TO PLAY:</h4><ol style="margin-left: 20px; margin-bottom: 16px;"><li>A large circular tap button appears in the center of the screen</li><li>Click or tap the button as fast as you can</li><li>Each tap increments your tap counter</li><li>You must reach the minimum required taps within the time limit to pass the level</li><li>Watch your tap rate (taps per second) displayed at the top</li><li>Each level has increasing difficulty with higher tap requirements</li></ol><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">LEVEL PROGRESSION:</h4><ul style="margin-left: 20px; margin-bottom: 16px;"><li><strong>Levels 1-3:</strong> Basic tapping (20-30 taps in 10s) - Get comfortable with the rhythm</li><li><strong>Levels 4-6:</strong> Speed up (35-45 taps in 10s) - Increase your tapping speed</li><li><strong>Levels 7-9:</strong> Rapid tapping (50-60 taps in 10s) - Very fast tapping required</li><li><strong>Levels 10-12:</strong> Lightning fast (65-75 taps in 10s) - Extremely fast tapping</li><li><strong>Levels 13-15:</strong> Ultimate speed (80-90 taps in 10s) - Maximum tapping speed</li></ul>',
    tips: 'Use multiple fingers or alternate hands for faster tapping. Keep a steady rhythm - consistency is key. Watch your tap rate to track your speed. On mobile, use multiple fingers. On desktop, you can use both mouse clicks and keyboard (Space/Enter). Practice maintaining speed throughout the entire time limit.',
    keyboardControls: [
      { keys: ['Space'], label: 'Tap the button (alternative to clicking)' },
      { keys: ['Enter'], label: 'Tap the button (alternative to clicking)' },
    ],
    mouseControls: [
      { action: 'Click', label: 'Click the large circular button to tap' },
      { action: 'Rapid Clicking', label: 'Click as fast as possible to maximize taps' },
    ],
  },
  'reflex-arrow': {
    description: 'Match arrow directions as fast as you can across 15 unique levels',
    instructions: '<p>An arrow will appear on screen. Quickly match the direction by pressing the corresponding arrow key (or clicking the arrow button on mobile/tablet). Each level requires a certain number of correct matches within the time limit.</p><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">HOW TO PLAY:</h4><ol style="margin-left: 20px; margin-bottom: 16px;"><li>An arrow will appear in the center of the screen pointing in one of four directions (↑ ↓ ← →).</li><li>Quickly press the matching arrow key on your keyboard (Arrow Keys or WASD).</li><li>On mobile/tablet, tap the corresponding arrow button.</li><li>Correct answers are counted towards your progress.</li><li>Reach the required number of correct answers within the time limit to pass the level.</li><li>If time runs out and you haven\'t reached the target, the level will fail.</li><li>Difficulty increases with each level: faster arrow changes and more correct answers required.</li></ol><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">LEVEL PROGRESSION:</h4><ul style="margin-left: 20px; margin-bottom: 16px;"><li><strong>Levels 1-3:</strong> 8-10 correct answers, arrows change every 2.1-2.5 seconds</li><li><strong>Levels 4-6:</strong> 11-13 correct answers, arrows change every 1.5-1.9 seconds</li><li><strong>Levels 7-9:</strong> 14-16 correct answers, arrows change every 1.1-1.3 seconds</li><li><strong>Levels 10-12:</strong> 17-19 correct answers, arrows change every 0.8-1.0 seconds</li><li><strong>Levels 13-15:</strong> 20-22 correct answers, arrows change every 0.5-0.7 seconds</li></ul>',
    tips: 'Focus on the arrow direction, not the position. Use muscle memory for faster responses. On desktop, use arrow keys for precision. On mobile, use the on-screen arrow buttons for quick tapping. Stay calm and react quickly.',
    keyboardControls: [
      { keys: ['Arrow Up', 'W'], label: 'Match up arrow (↑)' },
      { keys: ['Arrow Down', 'S'], label: 'Match down arrow (↓)' },
      { keys: ['Arrow Left', 'A'], label: 'Match left arrow (←)' },
      { keys: ['Arrow Right', 'D'], label: 'Match right arrow (→)' },
    ],
    mouseControls: [
      { action: 'Click/Tap', label: 'Tap the arrow button matching the displayed direction (mobile/tablet)' },
      { action: 'Quick Tap', label: 'Tap as fast as possible when arrow appears' },
    ],
  },
  
  // Skill Games
  'ball-balance': {
    description: 'Balance a ball on a platform using mouse/touch tilt across 15 challenging levels with special features',
    instructions: '<p>Tilt the platform using your mouse (move left/right) or touch (drag left/right) to keep the ball balanced in the center zone. Each level requires you to keep the ball in the center zone for a minimum amount of time. Don\'t let the ball fall off the platform!</p><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">SPECIAL FEATURES BY LEVEL:</h4><ul style="margin-left: 20px; margin-bottom: 16px;"><li><strong style="color: #3b82f6;">Levels 1-5:</strong> Basic balancing - learn the controls and physics</li><li><strong style="color: #f59e0b;">Levels 6-7:</strong> <strong>Shrinking Platform</strong> - Platform narrows faster and gets smaller</li><li><strong style="color: #ef4444;">Levels 8-9:</strong> <strong>Red Danger Zones</strong> - Avoid red zones on the sides! If the ball stays in a red zone for 1 second, you lose</li><li><strong style="color: #f59e0b;">Level 10:</strong> <strong>Shrinking Platform + Red Zones</strong> - Combined challenge</li><li><strong style="color: #8b5cf6;">Levels 11-12:</strong> <strong>Platform Shake</strong> - Stronger shake bursts that force quick corrections</li><li><strong style="color: #06b6d4;">Level 13:</strong> <strong>Wind Zones</strong> - Random wind pushes left or right</li><li><strong style="color: #8b5cf6;">Level 14:</strong> <strong>Platform Shake + Wind Zones</strong> - Double challenge</li><li><strong style="color: #dc2626;">Level 15:</strong> <strong>Ultimate Challenge</strong> - Shrinking Platform, Red Zones, Platform Shake, and Wind Zones</li></ul><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">HOW TO PLAY:</h4><ol style="margin-left: 20px; margin-bottom: 16px;"><li>Move your mouse left/right (or drag on touch devices) to tilt the platform</li><li>Keep the ball in the green center zone for the required time</li><li>Watch out for special features that activate in higher levels</li><li>Each level has increasing difficulty with more challenging physics and features</li><li>Complete all 15 levels to finish the game</li></ol>',
    tips: 'Make small, gentle movements - overcorrecting will make the ball fall faster. Focus on keeping the ball in the center zone (green dashed area). For shrinking platforms, plan ahead as space becomes limited. Avoid red zones at all costs - they cause instant failure. When platform shakes, stay calm and make quick corrections. In wind zones, compensate by tilting against the wind direction. Practice makes perfect - each level teaches new skills!',
    mouseControls: [
      { action: 'Move Mouse', label: 'Move mouse left/right over the arena to tilt the platform' },
      { action: 'Drag (Touch)', label: 'Drag finger left/right on mobile/tablet to tilt the platform' },
    ],
    keyboardControls: [
      { keys: ['ArrowLeft', 'A'], label: 'Tilt platform left' },
      { keys: ['ArrowRight', 'D'], label: 'Tilt platform right' },
    ],
  },
  'target-aim': {
    description: 'Aim and hit targets with precision across 15 progressively challenging levels. Move the viewport with WASD keys and hit targets with Enter or Space when they are near the center.',
    instructions: '<p>Move the viewport around the large arena using WASD keys. When a target appears near the center (white dot), press Enter or Space to hit it. Each level requires you to hit a minimum number of targets within the time limit. Targets appear at random positions and you must hit them before they disappear!</p><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">SPECIAL FEATURES BY LEVEL:</h4><ul style="margin-left: 20px; margin-bottom: 16px;"><li><strong style="color: #3b82f6;">Levels 1-4:</strong> Basic targets - stationary targets, easy to hit</li><li><strong style="color: #f59e0b;">Levels 5-7:</strong> <strong>Moving Targets</strong> - Targets move around the arena, bouncing off walls</li><li><strong style="color: #ef4444;">Levels 8-9:</strong> <strong>Multiple Targets</strong> - Multiple targets appear simultaneously</li><li><strong style="color: #f59e0b;">Level 10:</strong> <strong>Shrinking Targets</strong> - Targets shrink over time, making them harder to hit</li><li><strong style="color: #ef4444;">Levels 11-12:</strong> <strong>Moving + Shrinking</strong> - Combined challenge with moving and shrinking targets</li><li><strong style="color: #8b5cf6;">Levels 13-15:</strong> <strong>All Features</strong> - Moving, multiple, and shrinking targets all at once!</li></ul><p style="margin-top: 16px;">As you progress, targets become smaller, move faster, and more appear at once. Use WASD to navigate and Enter/Space to hit targets near the center!</p>',
    tips: 'Use WASD keys smoothly to move the viewport - don\'t rush! Aim slightly ahead of moving targets to account for their velocity. For multiple targets, prioritize the ones that are about to disappear. Shrinking targets require quick reactions - hit them while they\'re still large enough. Practice your hand-eye coordination and stay calm under pressure. Each level teaches new skills!',
    mouseControls: [
      { action: 'Click', label: 'Click on targets directly to hit them (alternative to Enter/Space)' },
    ],
    keyboardControls: [
      { keys: ['W', 'A', 'S', 'D'], label: 'Move viewport around the arena (W=up, A=left, S=down, D=right)' },
      { keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'], label: 'Move viewport with arrow keys (alternative to WASD)' },
      { keys: ['Enter', 'Space'], label: 'Hit the target nearest to the center (white dot) when it\'s within range' },
    ],
  },
  'line-tracer': {
    description: 'Trace paths with precision across 15 progressively challenging levels. Use your mouse or touch to follow the blue line as accurately as possible.',
    instructions: '<p>Trace the blue path shown on the screen using your mouse (or finger on touch devices). Hold down the mouse button and follow the path as closely as possible. Your accuracy and progress are measured in real-time. Each level requires a minimum accuracy percentage to pass.</p><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">SPECIAL FEATURES BY LEVEL:</h4><ul style="margin-left: 20px; margin-bottom: 16px;"><li><strong style="color: #3b82f6;">Levels 1-4:</strong> Simple smooth curves - learn the basics</li><li><strong style="color: #f59e0b;">Levels 5-7:</strong> <strong>Zigzag Patterns</strong> - Sharp turns and angles</li><li><strong style="color: #ef4444;">Levels 8-10:</strong> <strong>Spiral Paths</strong> - Circular and spiral patterns</li><li><strong style="color: #8b5cf6;">Levels 11-12:</strong> <strong>Complex Curves</strong> - Multiple curves and turns</li><li><strong style="color: #06b6d4;">Levels 13-14:</strong> <strong>Mixed Patterns</strong> - Combination of all path types</li><li><strong style="color: #dc2626;">Level 15:</strong> <strong>Master Challenge</strong> - Most complex path with highest accuracy requirement</li></ul><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">HOW TO PLAY:</h4><ol style="margin-left: 20px; margin-bottom: 16px;"><li>Click and hold your mouse button (or touch and hold on mobile)</li><li>Follow the blue path as closely as possible</li><li>Your traced path appears in green (good accuracy) or red (needs improvement)</li><li>Reach the required accuracy percentage to pass the level</li><li>Complete all 15 levels to finish the game</li></ol>',
    tips: 'Move slowly and steadily - accuracy is more important than speed. Keep your cursor close to the blue line. For sharp turns, slow down to maintain accuracy. Practice smooth movements - jerky movements reduce accuracy. Watch your real-time accuracy and progress stats. Each level teaches new skills!',
    mouseControls: [
      { action: 'Click & Hold', label: 'Click and hold mouse button to start tracing' },
      { action: 'Move Mouse', label: 'Move mouse along the blue path to trace it' },
      { action: 'Release', label: 'Release mouse button when done (or continue until time runs out)' },
    ],
    keyboardControls: [
      { keys: ['Mouse'], label: 'Use mouse to trace the path (keyboard not applicable for this game)' },
    ],
  },
  'timing-bar': {
    description: 'Stop the moving bar at the highlighted green zone. Test your timing and precision across 15 progressively challenging levels with increasing speed and smaller target zones.',
    instructions: 'A blue bar moves back and forth along a track. A green zone is highlighted on the track. Click anywhere on the arena when the bar is inside the green zone to stop it. You need to achieve a minimum number of successful stops within the time limit to pass each level. As levels progress, the bar moves faster and the target zone becomes smaller.',
    tips: 'Watch the rhythm and speed of the bar. Time your click carefully to match when the bar enters the green zone. Practice predicting the bar\'s movement pattern. Higher levels require faster reactions and more precision.',
    mouseControls: [
      { action: 'Click', label: 'Click anywhere on the arena to stop the bar when it\'s in the green zone' }
    ],
    keyboardControls: [
      { keys: ['Mouse'], label: 'Use mouse to click and stop the bar (keyboard not applicable for this game)' }
    ],
  },
  'stack-blocks': {
    description: 'Stack blocks as evenly as possible. Click on the moving green block to place it on the stack. Align blocks as close to center as possible to pass each level.',
    instructions: 'A green block moves left and right. Click on it or press Enter/Space to place it on the stack. You need to place a minimum number of blocks within the time limit. As levels progress, blocks move faster, become smaller, and require more blocks. Only the overlapping part stays when you place a block - if there\'s no overlap, the game ends.',
    tips: 'Watch the rhythm of the moving block. Time your click or keypress to place it aligned with the block below. Higher levels require more precision and faster reactions. Practice predicting the block\'s position.',
    mouseControls: [
      { action: 'Click', label: 'Click on the arena to place the moving green block on the stack' }
    ],
    keyboardControls: [
      { keys: ['Enter', 'Space'], label: 'Press Enter or Space to place the moving block on the stack' }
    ],
  },
  'precision-drop': {
    description: 'Drop object into small target area. Move the object left/right, then click to drop it. Land fully inside the target to score. Each level has multiple drops (mini levels) that must be completed.',
    instructions: 'Position the object above the target by moving your mouse or using arrow keys. Click or press Enter/Space to drop it. The target area gets smaller as levels progress. From level 5+, the target moves automatically. From level 10+, the platform shakes while the object is falling, making it harder to land accurately. You need to complete a minimum number of successful hits to pass each level.',
    tips: 'Take your time to aim before dropping. Small adjustments matter. Watch the target movement pattern in higher levels. For shake levels, try to drop when the shake offset is minimal.',
    mouseControls: [
      { action: 'Move', label: 'Move mouse left/right to position the object above the target' },
      { action: 'Click', label: 'Click to drop the object' }
    ],
    keyboardControls: [
      { keys: ['Arrow Left', 'Arrow Right'], label: 'Move object left/right' },
      { keys: ['Enter', 'Space'], label: 'Press Enter or Space to drop the object' }
    ],
  },
  'drag-sort': {
    description: 'Sort emojis into the matching categories. Levels go from simple visuals to real-world groups and logic.',
    instructions: 'Drag emojis into the matching bins. Later levels add more categories and faster timers. Some levels switch categories halfway.',
    tips: 'Match by look first (color/shape), then by meaning (animals, tools, safe vs danger). Wrong drops can cost time.',
    mouseControls: [
      { action: 'Drag', label: 'Click and drag items from the center area' },
      { action: 'Drop', label: 'Drop items into the correct category boxes' }
    ],
    keyboardControls: [
      { keys: ['Mouse/Touch'], label: 'Use mouse or touch to drag and drop items' }
    ],
  },
  'speed-drawing': {
    description: 'Draw shapes quickly and accurately within the time limit. Test your drawing skills across 15 progressively challenging levels.',
    instructions: '<p>Draw the target shape shown on screen using your mouse (or finger on touch devices). Click and hold to start drawing, then trace the shape as accurately as possible. The target shape is shown as a faded blue outline. Your drawing appears in blue. Each level requires a minimum accuracy percentage and drawing completion to pass.</p><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">SHAPES BY LEVEL:</h4><ul style="margin-left: 20px; margin-bottom: 16px;"><li><strong style="color: #3b82f6;">Levels 1-2:</strong> Circle & Square - Start with basic shapes</li><li><strong style="color: #f59e0b;">Levels 3-4:</strong> Triangle & Star - Geometric patterns</li><li><strong style="color: #ef4444;">Levels 5-6:</strong> Heart & Wave - Curved and flowing shapes</li><li><strong style="color: #8b5cf6;">Levels 7-8:</strong> Curve & Zigzag - Smooth and angular lines</li><li><strong style="color: #06b6d4;">Levels 9-10:</strong> Circle & Square - Revisit basics with higher accuracy</li><li><strong style="color: #dc2626;">Levels 11-12:</strong> Triangle & Star - Advanced geometric patterns</li><li><strong style="color: #10b981;">Levels 13-14:</strong> Heart & Wave - Master curved shapes</li><li><strong style="color: #f97316;">Level 15:</strong> Spiral - Ultimate challenge with complex spiral pattern</li></ul><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">HOW TO PLAY:</h4><ol style="margin-left: 20px; margin-bottom: 16px;"><li>Look at the target shape shown (faded blue outline)</li><li>Start drawing from the green START point (shown as a green circle)</li><li>For closed shapes (circle, square, triangle, star, heart, wave, spiral), follow the direction arrow and complete the full shape</li><li>For open shapes (curve, zigzag), draw from START to END point (red circle)</li><li>Click and hold your mouse button (or touch and hold on mobile) to start drawing</li><li>Draw the shape by moving your mouse/finger along the path</li><li>Release to finish your drawing</li><li>Your accuracy and completion progress are calculated in real-time</li><li>Reach both the required accuracy percentage (60-85%) and completion (70%) to pass the level</li><li>Complete all 15 levels to finish the game</li></ol>',
    tips: 'Draw slowly and carefully - accuracy is more important than speed. Always start from the green START point. Follow the faded blue outline as closely as possible. For closed shapes, make sure to complete the full shape and return close to the start point. For open shapes, ensure you reach the red END point. For shapes with straight lines (square, triangle, zigzag), use steady movements. For curved shapes (circle, heart, wave, curve, spiral), use smooth motions. Watch your accuracy and completion percentage in real-time. Practice makes perfect - each level teaches new drawing skills!',
    mouseControls: [
      { action: 'Click & Hold', label: 'Click and hold mouse button to start drawing' },
      { action: 'Move Mouse', label: 'Move mouse to draw the target shape' },
      { action: 'Release', label: 'Release mouse button when finished drawing' },
    ],
    keyboardControls: [
      { keys: ['Mouse/Touch'], label: 'Use mouse or touch to draw shapes (keyboard not applicable for this game)' },
    ],
  },
  'one-hand-mode': {
    description: 'Jump over obstacles using only one control. A runner-style game that tests your timing and reflexes across 15 challenging levels.',
    instructions: '<p>Control a character that runs automatically from left to right. Your only control is to make the character jump over obstacles. Click anywhere on the canvas, tap on mobile, or press Space to jump. Avoid hitting the red obstacles - if you touch one, the level fails!</p><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">HOW TO PLAY:</h4><ol style="margin-left: 20px; margin-bottom: 16px;"><li>Watch as obstacles (red blocks) approach from the right side</li><li>Click, tap, or press Space to jump over obstacles</li><li>Time your jumps carefully - jump too early or too late and you\'ll hit the obstacle</li><li>Blue obstacles are boosts - touching them gives a stronger jump and lets you jump again</li><li>From level 10+, you can double click to jump higher</li><li>Each level gets faster and more challenging</li></ol><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">PROGRESSIVE DIFFICULTY:</h4><ul style="margin-left: 20px; margin-bottom: 16px;"><li><strong style="color: #3b82f6;">Levels 1-5:</strong> Slower speed (260-380px/s), obstacles spawn every 1.1-0.95s</li><li><strong style="color: #f59e0b;">Levels 6-10:</strong> Medium speed (410-530px/s), obstacles spawn every 0.9-0.75s</li><li><strong style="color: #ef4444;">Levels 11-15:</strong> Fast speed (560-680px/s), obstacles spawn every 0.7-0.6s</li></ul>',
    tips: 'Timing is everything! Watch the obstacles approach and jump just before they reach you. Don\'t spam clicks - each jump has a cooldown. The character can only jump when on the ground. Practice your timing - you need to jump early enough to clear the obstacle but not so early that you land on it. As levels progress, obstacles spawn more frequently and move faster, so stay focused!',
    mouseControls: [
      { action: 'Click', label: 'Click anywhere on the canvas to make the character jump' },
      { action: 'Tap', label: 'Tap on mobile devices to jump' },
    ],
    keyboardControls: [
      { keys: ['Space'], label: 'Press Space to make the character jump' },
    ],
  },
  'cursor-maze': {
    description: 'Navigate a maze with your cursor to reach the green exit. Avoid touching walls or you\'ll reset to the start!',
    instructions: '<p>Control a blue square through a procedurally generated maze. Your goal is to reach the green exit without touching any walls. The game has 15 levels, each with increasing difficulty (larger mazes and shorter time limits).</p><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">HOW TO PLAY:</h4><ol style="margin-left: 20px; margin-bottom: 16px;"><li>Move your mouse (or drag your finger on mobile) inside the canvas to control the blue square.</li><li>You can also use WASD keys or Arrow keys to move the square.</li><li>Navigate from the blue START area to the green EXIT area.</li><li>Avoid touching walls - if you hit a wall, you\'ll reset to the START position.</li><li>Each level has a time limit. Complete the maze before time runs out.</li><li>Levels 1-5 have smaller mazes with more time.</li><li>Levels 6-10 have medium mazes with moderate time.</li><li>Levels 11-15 have larger mazes with less time.</li><li>Complete all 15 levels to finish the game!</li></ol><h4 style="margin-top: 16px; margin-bottom: 8px; font-weight: 600;">LEVEL PROGRESSION:</h4><ul style="margin-left: 20px; margin-bottom: 16px;"><li><strong>Levels 1-5:</strong> Smaller mazes (13-17 grid size), longer duration (60-52 seconds), fewer walls.</li><li><strong>Levels 6-10:</strong> Medium mazes (15-19 grid size), moderate duration (48-40 seconds), more walls.</li><li><strong>Levels 11-15:</strong> Larger mazes (18-22 grid size), shorter duration (38-30 seconds), many walls.</li></ul>',
    tips: 'Move slowly and carefully - precision beats speed! Plan your path before moving. Keep the square centered in corridors. On mobile, use touch and drag. Lift your finger to pause movement. The maze is procedurally generated, so each attempt is unique!',
    mouseControls: [
      { action: 'Move', label: 'Move mouse to control the blue square' },
      { action: 'Drag', label: 'Drag finger on mobile to control the square' },
    ],
    keyboardControls: [
      { keys: ['W', 'A', 'S', 'D'], label: 'Use WASD keys to move the square (W=Up, A=Left, S=Down, D=Right)' },
      { keys: ['Arrow Up', 'Arrow Left', 'Arrow Down', 'Arrow Right'], label: 'Use Arrow keys to move the square' },
    ],
  },
  
  // Final Games
  'mixed-quiz': {
    description: 'A challenging mix of logic, memory, speed, and skill games. Complete multiple rounds of randomly selected mini-games to test your overall cognitive abilities.',
    instructions: 'You\'ll face a series of randomly selected mini-games from different categories (Logic, Memory, Speed, and Skill). Each round presents a new challenge type. Complete all rounds to finish the quiz. Your final score is calculated as the average of all round scores. Adapt quickly to each new challenge type and stay focused throughout all rounds!',
    tips: 'Stay flexible - each round is different, so be ready for anything. Don\'t get discouraged if one round is harder - focus on the next one. Each mini-game has its own rules - pay attention to the instructions. Your overall performance matters more than individual round scores. Take a moment between rounds to mentally prepare for the next challenge.',
    keyboardControls: [],
    mouseControls: [
      {
        action: 'Interact with game elements',
        label: 'Click, drag, or move your mouse as required by each mini-game'
      }
    ]
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
