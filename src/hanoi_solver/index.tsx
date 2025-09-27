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

interface SolutionState {
  path: Move[];
  nodesExplored: number;
  algorithm: 'BFS' | 'DFS';
  goal?: Goal;
  phase1?: SearchResult;
  phase2?: SearchResult;
  totalMoves?: number;
  error?: string;
}

const HanoiSolver: React.FC = () => {
  const [solution, setSolution] = useState<SolutionState | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [animationSpeed, setAnimationSpeed] = useState<number>(500);
  const [currentGoal, setCurrentGoal] = useState<Goal>('B');

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

  // BFS Algorithm
  const solveBFS = useCallback((startState: State, goal: Goal): SearchResult | null => {
    interface QueueItem {
      state: State;
      path: Move[];
    }

    const queue: QueueItem[] = [{ state: startState, path: [] }];
    const visited = new Set<string>([stateToString(startState)]);
    let nodesExplored = 0;
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      const { state, path } = current;
      nodesExplored++;
      
      if (isGoalState(state, goal)) {
        return { path, nodesExplored, algorithm: 'BFS', goal };
      }
      
      const moves = getValidMoves(state);
      
      for (const move of moves) {
        const stateStr = stateToString(move.state);
        
        if (!visited.has(stateStr)) {
          visited.add(stateStr);
          queue.push({
            state: move.state,
            path: [...path, move]
          });
        }
      }
    }
    
    return null;
  }, []);

  // DFS Algorithm (with depth limit to prevent infinite recursion)
  const solveDFS = useCallback((startState: State, goal: Goal): SearchResult | null => {
    const visited = new Set<string>();
    let nodesExplored = 0;
    const maxDepth = 30; // Increased depth limit for complete solution
    
    const dfsHelper = (state: State, path: Move[], depth: number): SearchResult | null => {
      if (depth > maxDepth) return null;
      
      const stateStr = stateToString(state);
      if (visited.has(stateStr)) return null;
      
      visited.add(stateStr);
      nodesExplored++;
      
      if (isGoalState(state, goal)) {
        return { path, nodesExplored, algorithm: 'DFS', goal };
      }
      
      const moves = getValidMoves(state);
      
      for (const move of moves) {
        const result = dfsHelper(move.state, [...path, move], depth + 1);
        if (result) return result;
      }
      
      return null;
    };
    
    return dfsHelper(startState, [], 0);
  }, []);

  // Solve complete problem: A → B → C
  const solveComplete = (algorithm: 'BFS' | 'DFS'): void => {
    setIsSearching(true);
    setSolution(null);
    setCurrentStep(0);
    
    setTimeout(() => {
      // Phase 1: A → B
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
        totalMoves: phase1.path.length + phase2.path.length
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

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gradient-to-b from-blue-50 to-indigo-100 min-h-screen">
      <h1 className="text-3xl font-bold text-center mb-2 text-indigo-900">
        Tower of Hanoi Solver
      </h1>
      <p className="text-center text-gray-700 mb-6">
        4 Disks | Goal: A → B → C | Rule: Larger disk cannot go on smaller disk
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