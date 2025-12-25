import { KeyboardControl } from "@/components/GameEngine/KeyboardControls";

// Game instructions and descriptions for each game type
export const gameInstructions: Record<string, {
  description: string;
  instructions: string;
  tips?: string;
  keyboardControls?: KeyboardControl[];
}> = {
  // Logic Games
  'match-shapes': {
    description: 'Match shapes to their correct outlines',
    instructions: 'Look at the target shape at the top and click the matching shape from the options below.',
    tips: 'Pay attention to the shape details - circles, squares, and triangles can look similar!',
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
    tips: 'Focus on the order, not just the colors. Start from the first color and work your way through.'
  },
  'number-order': {
    description: 'Sort numbers from smallest to largest',
    instructions: 'Click the numbers in order from smallest to largest. Start with 1, then 2, then 3, and so on.',
    tips: 'Take your time to find the smallest number first, then work your way up.'
  },
  'find-odd-one': {
    description: 'Identify the object that\'s different',
    instructions: 'Look at the grid of shapes. One shape is different from all the others. Click on the odd one out!',
    tips: 'Most shapes will be the same - look for the one that doesn\'t match the pattern.'
  },
  'tile-slider': {
    description: 'Rearrange tiles into correct order',
    instructions: 'Click tiles adjacent to the empty space to slide them. Arrange numbers 1-8 in order from left to right, top to bottom.',
    tips: 'Work on getting the first row correct, then the second row. Plan your moves ahead!'
  },
  'balance-scale': {
    description: 'Determine which side of the scale is heavier',
    instructions: 'Look at the weights on both sides of the scale. Choose if the left side is heavier, right side is heavier, or if they are equal.',
    tips: 'Compare the numbers on each side. The larger number means that side is heavier.',
    keyboardControls: [
      { keys: ['ArrowLeft', 'A'], label: 'Left is Heavier' },
      { keys: ['ArrowRight', 'D'], label: 'Right is Heavier' },
      { keys: ['Enter', 'E', ' '], label: 'Equal' },
    ],
  },
  'light-switch': {
    description: 'Turn all lights off with limited moves',
    instructions: 'Click on a light to toggle it and adjacent lights. Your goal is to turn all lights off using as few moves as possible.',
    tips: 'Think about which lights affect others. Sometimes you need to turn a light on to turn others off.'
  },
  'maze-escape': {
    description: 'Navigate from start to exit',
    instructions: 'Use arrow keys (↑↓←→) to move your character (P) through the maze to reach the exit (E). Avoid walls!',
    tips: 'Plan your path before moving. Look for the shortest route to the exit.'
  },
  'pattern-completion': {
    description: 'Complete the missing pattern element',
    instructions: 'Look at the pattern sequence. One element is missing (shown as ?). Choose the correct shape to complete the pattern.',
    tips: 'Identify the pattern rule - it could be repeating, alternating, or following a sequence.'
  },
  'sudoku-4x4': {
    description: 'Fill the 4x4 grid with numbers 1-4',
    instructions: 'Click an empty cell, then select a number (1-4). Each row, column, and 2x2 box must contain numbers 1-4 without repetition.',
    tips: 'Start with cells that have only one possible number. Use the given numbers as clues.',
    keyboardControls: [
      { keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'], label: 'Navigate between cells' },
      { keys: ['1', '2', '3', '4'], label: 'Enter number directly' },
      { keys: ['Backspace', 'Delete'], label: 'Clear selected cell' },
    ],
  },
  'rotate-to-fit': {
    description: 'Rotate shapes to fit perfectly',
    instructions: 'Click the "Rotate 90°" button to rotate the shape until it fits perfectly into the target outline.',
    tips: 'Count your rotations - you may need to rotate 1, 2, 3, or 4 times to get the right orientation.'
  },
  'mirror-match': {
    description: 'Identify if images are mirrored or different',
    instructions: 'Look at the pair of shapes. Determine if they are mirror images (identical) or if they are different shapes.',
    tips: 'Imagine flipping one shape - if it matches the other, they are mirrors.'
  },
  'logic-gates': {
    description: 'Determine output of AND/OR gates',
    instructions: 'Look at the two inputs (0 or 1) and the gate type (AND or OR). Choose the correct output: 0 or 1.',
    tips: 'AND gate: output is 1 only if both inputs are 1. OR gate: output is 1 if at least one input is 1.'
  },
  'sequence-arrows': {
    description: 'Predict the next arrow in sequence',
    instructions: 'Look at the sequence of arrows (↑↓←→). One arrow is missing (shown as ?). Choose the arrow that completes the pattern.',
    tips: 'Look for repeating patterns or sequences. The pattern might be directional or rotational.'
  },
  'block-fill': {
    description: 'Fill the grid with all blocks',
    instructions: 'Select a block from the available blocks, then click on the grid to place it. Fill the entire grid without overlapping.',
    tips: 'Start with larger blocks first. Plan where each block will fit before placing it.'
  },
  
  // Memory Games
  'card-flip': {
    description: 'Classic card matching pairs',
    instructions: 'Click cards to flip them and reveal their symbols. Match pairs of identical symbols. Remember where each symbol is!',
    tips: 'Try to remember the positions of cards you\'ve already seen. Focus on finding pairs systematically.'
  },
  'sound-memory': {
    description: 'Repeat a sequence of sounds',
    instructions: 'Listen to the sequence of sounds, then repeat it by clicking the sound buttons in the same order.',
    tips: 'Pay attention to the rhythm and order. Try to remember the pattern, not just individual sounds.'
  },
  'emoji-memory': {
    description: 'Remember emoji positions',
    instructions: 'Memorize the positions of emojis on the grid. After they disappear, click on the cells where you saw each emoji.',
    tips: 'Create a mental map of the grid. Associate each emoji with its position.'
  },
  'number-recall': {
    description: 'Remember and type a number sequence',
    instructions: 'Watch the numbers appear on screen. After they disappear, type the sequence you saw in the correct order.',
    tips: 'Break long sequences into smaller chunks. Remember groups of 2-3 numbers at a time.'
  },
  'image-recall': {
    description: 'Remember image order',
    instructions: 'Watch the sequence of images. After they disappear, click on the images in the order you saw them.',
    tips: 'Create a story or association to remember the order. Visualize the sequence as a story.'
  },
  'path-memory': {
    description: 'Recreate a path on a grid',
    instructions: 'Watch the path that lights up on the grid. After it disappears, click on the cells to recreate the same path.',
    tips: 'Follow the path visually. Remember the starting point and the direction of movement.'
  },
  'word-memory': {
    description: 'Remember and select words',
    instructions: 'Read the list of words carefully. After they disappear, select the words you saw from the options.',
    tips: 'Try to remember the first and last words, then work on the middle ones. Create associations.'
  },
  'face-memory': {
    description: 'Match faces with names',
    instructions: 'Study the faces and their names. After they disappear, match each face with its correct name.',
    tips: 'Look for distinctive features on each face. Associate names with facial characteristics.'
  },
  'color-grid-memory': {
    description: 'Remember highlighted grid cells',
    instructions: 'Watch which cells are highlighted on the grid. After they disappear, click on the cells that were highlighted.',
    tips: 'Remember the pattern, not individual cells. Look for shapes or patterns in the highlighted cells.'
  },
  'symbol-stack': {
    description: 'Rebuild a stack of symbols',
    instructions: 'Watch the symbols stack up one by one. After they disappear, recreate the stack by clicking symbols in the correct order.',
    tips: 'Remember from bottom to top. The first symbol you see goes at the bottom of the stack.'
  },
  
  // Speed Games
  'click-green': {
    description: 'Click only green items quickly',
    instructions: 'Green and red items will appear. Click ONLY on the green items as fast as you can. Avoid clicking red items!',
    tips: 'Stay focused and react quickly. Don\'t click too fast or you might hit a red item by mistake.'
  },
  'avoid-red': {
    description: 'Avoid red obstacles for set duration',
    instructions: 'Move your cursor to avoid red obstacles. Keep moving and don\'t let the red items touch you!',
    tips: 'Keep your cursor moving. Watch for red items coming from all directions.'
  },
  'reaction-test': {
    description: 'Click as fast as possible after color change',
    instructions: 'Watch the screen. When the color changes, click as quickly as possible. Your reaction time is measured!',
    tips: 'Keep your finger ready. Don\'t click before the color changes, or you\'ll get a penalty.'
  },
  'fast-math': {
    description: 'Solve math problems quickly',
    instructions: 'Simple math problems will appear. Solve them as quickly as possible by clicking the correct answer.',
    tips: 'Practice mental math. For addition and subtraction, work quickly but accurately.'
  },
  'whack-shape': {
    description: 'Click the correct shape type',
    instructions: 'Shapes will appear on screen. Click only on the shape type that matches the target (circle, square, or triangle).',
    tips: 'Focus on the shape type, not the color. React quickly but accurately.'
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
} {
  // Try to find by gameType first
  if (gameInstructions[gameType]) {
    return gameInstructions[gameType];
  }
  
  // Try to find by title (case-insensitive)
  if (gameTitle) {
    const titleLower = gameTitle.toLowerCase();
    for (const [key, value] of Object.entries(gameInstructions)) {
      if (titleLower.includes(key.replace('-', ' ')) || titleLower.includes(key)) {
        return value;
      }
    }
  }
  
  // Default fallback
  return {
    description: 'Complete the challenge to earn points',
    instructions: 'Follow the on-screen instructions and complete the game within the time limit.',
    tips: 'Read the instructions carefully and take your time.'
  };
}

