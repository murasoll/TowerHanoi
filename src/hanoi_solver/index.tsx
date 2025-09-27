import React, { useState, useCallback, type JSX } from 'react';

// Type definitions
type Rod = number[];
type State = [Rod, Rod, Rod];
type Goal = 'B' | 'C';

interface Move {
  state: State;
  move: string;
  from: number;
  to: number;
  disk: number;
}

interface SearchResult {
  path: Move[];
  nodesExplored: number;
  algorithm: 'BFS' | 'DFS';
  goal?: Goal;
}

interface CompleteSolution extends SearchResult {
  phase1: SearchResult;
  phase2: SearchResult;
  totalMoves: number;
}

// NodeGraphNode structure to represent the tree
interface NodeGraphNode {
  state: State;
  move?: string;
  children: NodeGraphNode[];
  step?: number; // step in solution path if part of solution
}

interface SolutionState {
  path: Move[];
  nodesExplored: number;
  algorithm: 'BFS' | 'DFS';
  goal?: Goal;
  phase1?: SearchResult;
  phase2?: SearchResult;
  totalMoves?: number;
  error?: string;
  tree?: NodeGraphNode;
}

const HanoiSolver: React.FC = () => {
  const [solution, setSolution] = useState<SolutionState | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [animationSpeed, setAnimationSpeed] = useState<number>(500);
  const [currentGoal, setCurrentGoal] = useState<Goal>('B');
  const [showFullTree, setShowFullTree] = useState<boolean>(true);

  // State representation: [rod_A, rod_B, rod_C] where each rod is array of disks (1=smallest, 4=largest)
  const initialState: State = [[4, 3, 2, 1], [], []];
  
  // Convert state to string for comparison
  const stateToString = (state: State): string => JSON.stringify(state);
  
  // Check if state matches current goal
  const isGoalState = (state: State, goal: Goal): boolean => {
    const [rodA, rodB, rodC] = state;
    if (goal === 'B') {
      // Goal: All disks on rod B
      return rodA.length === 0 && rodB.length === 4 && rodC.length === 0;
    } else if (goal === 'C') {
      // Goal: All disks on rod C (starting from rod B)
      return rodA.length === 0 && rodB.length === 0 && rodC.length === 4;
    }
    return false;
  };
  
  // Get valid moves from current state (enforcing Hanoi rules)
  const getValidMoves = (state: State): Move[] => {
    const moves: Move[] = [];
    const [rodA, rodB, rodC] = state.map(rod => [...rod]);
    const rods: Rod[] = [rodA, rodB, rodC];
    
    for (let from = 0; from < 3; from++) {
      if (rods[from].length === 0) continue; // No disk to move
      
      const diskToMove = rods[from][rods[from].length - 1]; // Top disk
      
      for (let to = 0; to < 3; to++) {
        if (from === to) continue;
        
        // Check if move is valid: target rod is empty OR top disk on target is larger
        const canMove = rods[to].length === 0 || rods[to][rods[to].length - 1] > diskToMove;
        
        if (canMove) {
          const newState: State = rods.map(rod => [...rod]) as State;
          const disk = newState[from].pop()!;
          newState[to].push(disk);
          
          moves.push({
            state: newState,
            move: `Move disk ${disk} from ${String.fromCharCode(65 + from)} to ${String.fromCharCode(65 + to)}`,
            from,
            to,
            disk
          });
        }
      }
    }
    
    return moves;
  };

  // NodeGraphNode structure to represent the tree
  interface NodeGraphNode {
    state: State;
    move?: string;
    children: NodeGraphNode[];
    step?: number; // step in solution path if part of solution
  }

  // BFS Algorithm
  const solveBFS = useCallback((startState: State, goal: Goal): (SearchResult & { tree: NodeGraphNode }) | null => {
    interface QueueItem {
      state: State;
      path: Move[];
      node: NodeGraphNode;
    }

    const queue: QueueItem[] = [{
      state: startState,
      path: [],
      node: { state: startState, children: [] }
    }];
    const visited = new Map<string, NodeGraphNode>();
    visited.set(stateToString(startState), queue[0].node);
    let nodesExplored = 0;
    let solutionPath: Move[] = [];
    let solutionNode: NodeGraphNode | null = null;

    while (queue.length > 0) {
      const current = queue.shift()!;
      const { state, path, node } = current;
      nodesExplored++;

      if (isGoalState(state, goal)) {
        solutionPath = path;
        solutionNode = node;
        break;
      }

      const moves = getValidMoves(state);
      for (const move of moves) {
        const stateStr = stateToString(move.state);
        if (!visited.has(stateStr)) {
          const childNode: NodeGraphNode = {
            state: move.state,
            move: move.move,
            children: []
          };
          node.children.push(childNode);
          visited.set(stateStr, childNode);
          queue.push({
            state: move.state,
            path: [...path, move],
            node: childNode
          });
        }
      }
    }

    // Mark solution path in tree for highlighting
    if (solutionNode && solutionPath.length > 0) {
      let node = visited.get(stateToString(startState));
      let step = 0;
      let state = startState;
      for (const move of solutionPath) {
        const nextStr = stateToString(move.state);
        const child = node?.children.find(n => stateToString(n.state) === nextStr);
        if (child) {
          child.step = ++step;
          node = child;
          state = move.state;
        }
      }
    }

    if (solutionPath.length > 0) {
      return {
        path: solutionPath,
        nodesExplored,
        algorithm: 'BFS',
        goal,
        tree: visited.get(stateToString(startState))!
      };
    }
    return null;
  }, []);

  // DFS Algorithm (with depth limit to prevent infinite recursion)
  const solveDFS = useCallback((startState: State, goal: Goal): (SearchResult & { tree: NodeGraphNode }) | null => {
    const visited = new Map<string, NodeGraphNode>();
    let nodesExplored = 0;
    const maxDepth = 30; // Increased depth limit for complete solution
    let solutionPath: Move[] = [];
    let found = false;

    const dfsHelper = (state: State, path: Move[], node: NodeGraphNode, depth: number): void => {
      if (found || depth > maxDepth) return;
      const stateStr = stateToString(state);
      if (visited.has(stateStr)) return;
      visited.set(stateStr, node);
      nodesExplored++;

      if (isGoalState(state, goal)) {
        solutionPath = path;
        found = true;
        return;
      }

      const moves = getValidMoves(state);
      for (const move of moves) {
        const childNode: NodeGraphNode = {
          state: move.state,
          move: move.move,
          children: []
        };
        node.children.push(childNode);
        dfsHelper(move.state, [...path, move], childNode, depth + 1);
        if (found) return;
      }
    };

    const root: NodeGraphNode = { state: startState, children: [] };
    dfsHelper(startState, [], root, 0);

    // Mark solution path in tree for highlighting
    if (solutionPath.length > 0) {
      let node = visited.get(stateToString(startState));
      let step = 0;
      let state = startState;
      for (const move of solutionPath) {
        const nextStr = stateToString(move.state);
        const child = node?.children.find(n => stateToString(n.state) === nextStr);
        if (child) {
          child.step = ++step;
          node = child;
          state = move.state;
        }
      }
    }

    if (solutionPath.length > 0) {
      return {
        path: solutionPath,
        nodesExplored,
        algorithm: 'DFS',
        goal,
        tree: visited.get(stateToString(startState))!
      };
    }
    return null;
  }, []);

  // Solve complete problem: A → B → C
  const solveComplete = (algorithm: 'BFS' | 'DFS'): void => {
    setIsSearching(true);
    setSolution(null);
    setCurrentStep(0);
    
    setTimeout(() => {
      const solveFunc = algorithm === 'BFS' ? solveBFS : solveDFS;
      const phase1 = solveFunc(initialState, 'B');
      
      if (!phase1) {
        setSolution({ 
          error: 'No solution found for A → B',
          path: [],
          nodesExplored: 0,
          algorithm
        });
        setIsSearching(false);
        return;
      }
      
      // Get the state after phase 1 (all disks on B)
      let stateAfterPhase1: State = [...initialState.map(rod => [...rod])] as State;
      for (const move of phase1.path) {
        const disk = stateAfterPhase1[move.from].pop()!;
        stateAfterPhase1[move.to].push(disk);
      }
      
      // Phase 2: B → C
      const phase2 = solveFunc(stateAfterPhase1, 'C');
      
      if (!phase2) {
        setSolution({ 
          error: 'No solution found for B → C',
          path: [],
          nodesExplored: 0,
          algorithm
        });
        setIsSearching(false);
        return;
      }
      
      // Combine both phases
      const completeSolution: SolutionState = {
        path: [...phase1.path, ...phase2.path],
        nodesExplored: phase1.nodesExplored + phase2.nodesExplored,
        algorithm,
        phase1: phase1,
        phase2: phase2,
        totalMoves: phase1.path.length + phase2.path.length,
        tree: phase1.tree // show phase1 tree for complete
      };
      
      setSolution(completeSolution);
      setIsSearching(false);
    }, 100);
  };

  const handleSolve = (algorithm: 'BFS' | 'DFS'): void => {
    solveComplete(algorithm);
  };

  // Solve single phase (A→B or B→C)
  const handleSolveSingle = (algorithm: 'BFS' | 'DFS', goal: Goal): void => {
    setIsSearching(true);
    setSolution(null);
    setCurrentStep(0);
    setCurrentGoal(goal);
    
    setTimeout(() => {
      const solveFunc = algorithm === 'BFS' ? solveBFS : solveDFS;
      const startState: State = goal === 'B' ? initialState : [[], [4, 3, 2, 1], []]; // B→C starts with all disks on B
      const result = solveFunc(startState, goal);
      
      if (result) {
        setSolution(result);
      } else {
        setSolution({
          error: `No solution found for ${goal === 'B' ? 'A → B' : 'B → C'}`,
          path: [],
          nodesExplored: 0,
          algorithm
        });
      }
      setIsSearching(false);
    }, 100);
  };

  const renderRods = (state: State): JSX.Element => {
    const [rodA, rodB, rodC] = state;
    const rodNames: string[] = ['A', 'B', 'C'];
    const rods: Rod[] = [rodA, rodB, rodC];
    
    return (
      <div className="flex justify-center gap-8 mb-6">
        {rods.map((rod, rodIndex) => (
          <div key={rodIndex} className="flex flex-col items-center">
            <div className="text-lg font-bold mb-2">{rodNames[rodIndex]}</div>
            <div className="relative">
              {/* Rod pole */}
              <div className="w-2 h-32 bg-amber-800 mx-auto"></div>
              {/* Base */}
              <div className="w-20 h-3 bg-amber-900 -mt-1"></div>
              {/* Disks */}
              <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex flex-col-reverse">
                {rod.map((disk, diskIndex) => {
                  const width = 10 + disk * 8;
                  const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500'];
                  return (
                    <div
                      key={diskIndex}
                      className={`h-4 rounded ${colors[disk - 1]} border-2 border-gray-800 mb-1`}
                      style={{ width: `${width}px`, marginLeft: `-${width/2}px`, marginRight: `-${width/2}px` }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const getCurrentState = (): State => {
    if (!solution || currentStep === 0) return initialState;
    
    let state: State = [...initialState.map(rod => [...rod])] as State;
    for (let i = 0; i < currentStep && i < solution.path.length; i++) {
      const move = solution.path[i];
      const disk = state[move.from].pop()!;
      state[move.to].push(disk);
    }
    return state;
  };

  const nextStep = (): void => {
    if (solution && currentStep < solution.path.length) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = (): void => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const autoPlay = (): void => {
    if (!solution) return;
    
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= solution.path.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, animationSpeed);
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setAnimationSpeed(Number(e.target.value));
  };

  // Helper to build a tree from the solution path (for visualization)
  const buildNodeGraph = (startState: State, path: Move[]): NodeGraphNode => {
    // Build a tree from the path (linear for optimal solution)
    let root: NodeGraphNode = { state: startState, children: [] };
    let current = root;
    for (const move of path) {
      const node: NodeGraphNode = { state: move.state, move: move.move, children: [] };
      current.children.push(node);
      current = node;
    }
    return root;
  };

  // --- Enhanced NodeGraph visualization ---
  const renderStateAsLetters = (state: State): string => {
    const [rodA, rodB, rodC] = state;
    let result = '';
    // Changed loop to go from 1 to 4 (smallest to largest)
    for (let disk = 1; disk <= 4; disk++) {
      if (rodA.includes(disk)) result += 'a';
      else if (rodB.includes(disk)) result += 'b';
      else if (rodC.includes(disk)) result += 'c';
    }
    return result;
  };

  interface TreeNode {
    state: State;
    stateStr: string;
    isChosen: boolean;
    children: TreeNode[];
    level: number;  // depth in tree
    position: number;  // horizontal position
  }

  const NodeGraph: React.FC<{ root: NodeGraphNode; highlightStep?: number }> = ({ root, highlightStep }) => {
    const buildTreeInfo = (node: NodeGraphNode, level: number = 0, position: number = 0): TreeNode => {
      const allMoves = getValidMoves(node.state);
      const chosenChild = node.children.find(child => child.step !== undefined);
      const sortedMoves = allMoves.sort((a, b) => 
        renderStateAsLetters(a.state).localeCompare(renderStateAsLetters(b.state))
      );

      // Calculate children positions to center them under parent
      const totalChildren = sortedMoves.length;
      const startPos = position - (totalChildren - 1) / 2;

      const children = sortedMoves.map((move, index) => {
        const childNode = node.children.find(
          child => stateToString(child.state) === stateToString(move.state)
        );
        const isChosen = childNode === chosenChild;

        if (isChosen && childNode) {
          return buildTreeInfo(childNode, level + 1, startPos + index);
        }

        return {
          state: move.state,
          stateStr: renderStateAsLetters(move.state),
          isChosen: false,
          children: [],
          level: level + 1,
          position: startPos + index
        };
      });

      return {
        state: node.state,
        stateStr: renderStateAsLetters(node.state),
        isChosen: node.step !== undefined,
        children,
        level,
        position
      };
    };

    const renderLines = (node: TreeNode): JSX.Element[] => {
      const nodeSize = { width: 64, height: 28 }; // Approximate node dimensions
      
      return node.children.flatMap(child => {
        // Calculate start and end points
        const startX = node.position * 100;
        const startY = node.level * 60 + nodeSize.height / 2;
        const endX = child.position * 100;
        const endY = child.level * 60 + nodeSize.height / 2;

        return [
          <div
            key={`line-${node.stateStr}-${child.stateStr}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                overflow: 'visible',
              }}
            >
              <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke="#CBD5E0"
                strokeWidth={1}
              />
            </svg>
          </div>,
          ...renderLines(child)
        ];
      });
    };

    const renderNode = (node: TreeNode): JSX.Element => {
      const isHighlighted = highlightStep !== undefined && node.isChosen && 
        node.children.some(child => child.isChosen);

      return (
        <div 
          style={{
            position: 'absolute',
            left: `${node.position * 100}px`,
            top: `${node.level * 60}px`,
            transform: 'translate(-50%, 0)',
            zIndex: 1
          }}
        >
          <div 
            className={`px-2 py-1 font-mono text-sm rounded ${
              isHighlighted ? 'bg-yellow-100 border-2 border-yellow-400' :
              node.isChosen ? 'bg-green-50 border-2 border-green-400' :
              'bg-gray-50 border border-gray-200 text-gray-400'
            }`}
          >
            {node.stateStr}
          </div>
        </div>
      );
    };

    const treeInfo = buildTreeInfo(root);

    // Helper to get tree dimensions for visualization
    const getTreeDimensions = (node: TreeNode): { width: number; height: number } => {
      // Find min/max position and max level
      let minPos = node.position;
      let maxPos = node.position;
      let maxLevel = node.level;

      const traverse = (n: TreeNode) => {
        if (n.position < minPos) minPos = n.position;
        if (n.position > maxPos) maxPos = n.position;
        if (n.level > maxLevel) maxLevel = n.level;
        n.children.forEach(traverse);
      };
      traverse(node);

      // Each position is 100px apart, each level is 60px apart
      return {
        width: (maxPos - minPos + 1) * 100,
        height: (maxLevel + 1) * 60
      };
    };

    // Helper to render all nodes recursively
    const renderAllNodes = (node: TreeNode): JSX.Element[] => {
      return [
        renderNode(node),
        ...node.children.flatMap(renderAllNodes)
      ];
    };

    const dimensions = getTreeDimensions(treeInfo);

    return (
      <div className="overflow-x-auto p-4">
        <div 
          style={{ 
            position: 'relative',
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
            margin: '0 auto',
            transform: 'scale(0.7)',
            transformOrigin: 'top center'
          }}
        >
          {/* Render lines first (behind nodes) */}
          {renderLines(treeInfo)}
          
          {/* Render all nodes */}
          {renderAllNodes(treeInfo).map((node, index) => (
            <React.Fragment key={index}>{node}</React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gradient-to-b from-blue-50 to-indigo-100 min-h-screen">
      <h1 className="text-3xl font-bold text-center mb-2 text-indigo-900">
        Tower of Hanoi Solver
      </h1>
      <p className="text-center text-gray-700 mb-6">
        4 Disks | Goal: A → B → C | Rule: Larger disk cannot go on top of a smaller disk
      </p>

      {/* Controls */}
      <div className="space-y-4 mb-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Complete Solution (A → B → C)</h3>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => handleSolve('BFS')}
              disabled={isSearching}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {isSearching ? 'Searching...' : 'Complete BFS'}
            </button>
            <button
              onClick={() => handleSolve('DFS')}
              disabled={isSearching}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
            >
              {isSearching ? 'Searching...' : 'Complete DFS'}
            </button>
          </div>
        </div>

        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Single Phase Solutions</h3>
          <div className="flex justify-center gap-2 flex-wrap">
            <button
              onClick={() => handleSolveSingle('BFS', 'B')}
              disabled={isSearching}
              className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 disabled:bg-gray-400"
            >
              A→B (BFS)
            </button>
            <button
              onClick={() => handleSolveSingle('DFS', 'B')}
              disabled={isSearching}
              className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 disabled:bg-gray-400"
            >
              A→B (DFS)
            </button>
            <button
              onClick={() => handleSolveSingle('BFS', 'C')}
              disabled={isSearching}
              className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-400"
            >
              B→C (BFS)
            </button>
            <button
              onClick={() => handleSolveSingle('DFS', 'C')}
              disabled={isSearching}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400"
            >
              B→C (DFS)
            </button>
          </div>
        </div>
      </div>

      {/* Tower Visualization */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-center">Current State</h2>
        {renderRods(getCurrentState())}
        
        {/* Rules Reminder */}
        <div className="text-center text-sm text-gray-600 mt-4">
          <p className="font-semibold">Rules:</p>
          <p>• Only move one disk at a time (top disk only)</p>
          <p>• A larger disk cannot be placed on top of a smaller disk</p>
          <p>• Goal: Move all disks from A to B, then from B to C</p>
        </div>
      </div>

      {/* Solution Display */}
      {solution && !solution.error && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Solution found using {solution.algorithm}!
            {solution.totalMoves && ` (Complete: A → B → C)`}
            {solution.goal && ` (Phase: A → ${solution.goal})`}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center p-4 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-blue-600">
                {solution.totalMoves || solution.path.length}
              </div>
              <div className="text-sm text-gray-600">Total Moves</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-green-600">{solution.nodesExplored}</div>
              <div className="text-sm text-gray-600">Nodes Explored</div>
            </div>
            {solution.phase1 && solution.phase2 && (
              <div className="text-center p-4 bg-gray-50 rounded">
                <div className="text-lg font-bold text-purple-600">
                  {solution.phase1.path.length} + {solution.phase2.path.length}
                </div>
                <div className="text-sm text-gray-600">A→B + B→C</div>
              </div>
            )}
          </div>

          {/* Animation Controls */}
          <div className="flex justify-center items-center gap-4 mb-4">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300"
            >
              ← Previous
            </button>
            <span className="text-lg font-semibold">
              Step {currentStep} of {solution.path.length}
            </span>
            <button
              onClick={nextStep}
              disabled={currentStep >= solution.path.length}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300"
            >
              Next →
            </button>
          </div>

          <div className="flex justify-center items-center gap-4 mb-4">
            <label className="text-sm">Speed:</label>
            <input
              type="range"
              min="100"
              max="1000"
              value={animationSpeed}
              onChange={handleSpeedChange}
              className="w-32"
            />
            <span className="text-sm">{animationSpeed}ms</span>
            <button
              onClick={autoPlay}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Auto Play
            </button>
          </div>

          {/* Current Move Display */}
          {currentStep > 0 && currentStep <= solution.path.length && (
            <div className="bg-yellow-100 border border-yellow-300 rounded p-3 mb-4">
              <strong>Current Move:</strong> {solution.path[currentStep - 1].move}
              {solution.phase1 && solution.phase2 && (
                <span className="ml-2 text-sm text-gray-600">
                  {currentStep <= solution.phase1.path.length ? '(Phase 1: A→B)' : '(Phase 2: B→C)'}
                </span>
              )}
            </div>
          )}

          {/* Move List */}
          <div className="max-h-60 overflow-y-auto border rounded p-4">
            <h3 className="font-semibold mb-2">All Moves:</h3>
            {solution.path.map((move, index) => (
              <div
                key={index}
                className={`p-2 mb-1 rounded ${
                  index < currentStep ? 'bg-green-100' : 
                  index === currentStep - 1 ? 'bg-yellow-100' : 'bg-gray-50'
                }`}
              >
                {index + 1}. {move.move}
                {solution.phase1 && solution.phase2 && (
                  <span className="ml-2 text-xs text-gray-500">
                    {index < solution.phase1.path.length ? '(A→B)' : '(B→C)'}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Node Graph Visualization */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-2 text-center">
              Node Graph ({solution.algorithm})
            </h3>
            <div className="flex justify-center mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showFullTree}
                  onChange={e => setShowFullTree(e.target.checked)}
                  className="form-checkbox"
                />
                <span className="text-sm">Show Full Search Tree</span>
              </label>
            </div>
            <div className="overflow-x-auto p-2 bg-gray-100 rounded">
              <NodeGraph
                root={showFullTree
                  ? (solution.tree ?? { state: initialState, children: [] })
                  : buildNodeGraph(initialState, solution.path)}
                highlightStep={currentStep}
              />
            </div>
          </div>
        </div>
      )}

      {solution && solution.error && (
        <div className="bg-red-100 border border-red-300 rounded p-4 mb-6">
          <p className="text-red-700">{solution.error}</p>
        </div>
      )}

      {/* Theory Section */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Theory & Algorithm Comparison</h2>
        
        <div className="mb-6">
          <h3 className="font-bold text-indigo-600 mb-2">Expected Results for 4 Disks:</h3>
          <ul className="text-sm space-y-1 ml-4">
            <li>• A → B: 15 moves (2⁴ - 1)</li>
            <li>• B → C: 15 moves (2⁴ - 1)</li>
            <li>• Complete A → B → C: 30 moves total</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-bold text-blue-600 mb-2">BFS (Breadth-First Search)</h3>
            <ul className="text-sm space-y-1">
              <li>• Explores all nodes at current depth first</li>
              <li>• Guarantees optimal solution (minimum moves)</li>
              <li>• Higher memory usage (stores frontier)</li>
              <li>• Systematic level-by-level exploration</li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-green-600 mb-2">DFS (Depth-First Search)</h3>
            <ul className="text-sm space-y-1">
              <li>• Goes deep into one path before backtracking</li>
              <li>• May find suboptimal solution first</li>
              <li>• Lower memory usage (current path only)</li>
              <li>• Can be faster if solution is in first explored path</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HanoiSolver;