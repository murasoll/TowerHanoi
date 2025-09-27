import React, { useState, useCallback, type JSX } from "react";
import { Play, ChevronLeft, ChevronRight, Pause, Search, BarChart3 } from 'lucide-react';

// Type definitions
type Rod = number[];
type State = [Rod, Rod, Rod];
type Goal = "B" | "C";

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
  algorithm: "BFS" | "DFS";
  goal?: Goal;
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
  algorithm: "BFS" | "DFS";
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
  const [showFullTree, ] = useState<boolean>(true);
  const [isAutoPlaying, ] = useState(false);
  
  // State representation: [rod_A, rod_B, rod_C] where each rod is array of disks (1=smallest, 4=largest)
  const initialState: State = [[4, 3, 2, 1], [], []];

  // Convert state to string for comparison
  const stateToString = (state: State): string => JSON.stringify(state);

  // Check if state matches current goal
  const isGoalState = (state: State, goal: Goal): boolean => {
    const [rodA, rodB, rodC] = state;
    if (goal === "B") {
      // Goal: All disks on rod B
      return rodA.length === 0 && rodB.length === 4 && rodC.length === 0;
    } else if (goal === "C") {
      // Goal: All disks on rod C (starting from rod B)
      return rodA.length === 0 && rodB.length === 0 && rodC.length === 4;
    }
    return false;
  };

  // Get valid moves from current state (enforcing Hanoi rules)
  const getValidMoves = (state: State): Move[] => {
    const moves: Move[] = [];
    const [rodA, rodB, rodC] = state.map((rod) => [...rod]);
    const rods: Rod[] = [rodA, rodB, rodC];

    for (let from = 0; from < 3; from++) {
      if (rods[from].length === 0) continue; // No disk to move

      const diskToMove = rods[from][rods[from].length - 1]; // Top disk

      for (let to = 0; to < 3; to++) {
        if (from === to) continue;

        // Check if move is valid: target rod is empty OR top disk on target is larger
        const canMove =
          rods[to].length === 0 || rods[to][rods[to].length - 1] > diskToMove;

        if (canMove) {
          const newState: State = rods.map((rod) => [...rod]) as State;
          const disk = newState[from].pop()!;
          newState[to].push(disk);

          moves.push({
            state: newState,
            move: `Move disk ${disk} from ${String.fromCharCode(
              65 + from
            )} to ${String.fromCharCode(65 + to)}`,
            from,
            to,
            disk,
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
  const solveBFS = useCallback(
    (
      startState: State,
      goal: Goal
    ): (SearchResult & { tree: NodeGraphNode }) | null => {
      interface QueueItem {
        state: State;
        path: Move[];
        node: NodeGraphNode;
      }

      const queue: QueueItem[] = [
        {
          state: startState,
          path: [],
          node: { state: startState, children: [] },
        },
      ];
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
              children: [],
            };
            node.children.push(childNode);
            visited.set(stateStr, childNode);
            queue.push({
              state: move.state,
              path: [...path, move],
              node: childNode,
            });
          }
        }
      }

      // Mark solution path in tree for highlighting
      if (solutionNode && solutionPath.length > 0) {
        let node = visited.get(stateToString(startState));
        let step = 0;
        for (const move of solutionPath) {
          const nextStr = stateToString(move.state);
          const child = node?.children.find(
            (n) => stateToString(n.state) === nextStr
          );
          if (child) {
            child.step = ++step;
            node = child;
          }
        }
      }

      if (solutionPath.length > 0) {
        return {
          path: solutionPath,
          nodesExplored,
          algorithm: "BFS",
          goal,
          tree: visited.get(stateToString(startState))!,
        };
      }
      return null;
    },
    []
  );

  // DFS Algorithm (with depth limit to prevent infinite recursion)
  const solveDFS = useCallback(
    (
      startState: State,
      goal: Goal
    ): (SearchResult & { tree: NodeGraphNode }) | null => {
      const visited = new Map<string, NodeGraphNode>();
      let nodesExplored = 0;
      const maxDepth = 30; // Increased depth limit for complete solution
      let solutionPath: Move[] = [];
      let found = false;

      const dfsHelper = (
        state: State,
        path: Move[],
        node: NodeGraphNode,
        depth: number
      ): void => {
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
            children: [],
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
        for (const move of solutionPath) {
          const nextStr = stateToString(move.state);
          const child = node?.children.find(
            (n) => stateToString(n.state) === nextStr
          );
          if (child) {
            child.step = ++step;
            node = child;
          }
        }
      }

      if (solutionPath.length > 0) {
        return {
          path: solutionPath,
          nodesExplored,
          algorithm: "DFS",
          goal,
          tree: visited.get(stateToString(startState))!,
        };
      }
      return null;
    },
    []
  );

  // Solve complete problem: A → B → C
  const solveComplete = (algorithm: "BFS" | "DFS"): void => {
    setIsSearching(true);
    setSolution(null);
    setCurrentStep(0);

    setTimeout(() => {
      const solveFunc = algorithm === "BFS" ? solveBFS : solveDFS;
      const phase1 = solveFunc(initialState, "B");

      if (!phase1) {
        setSolution({
          error: "No solution found for A → B",
          path: [],
          nodesExplored: 0,
          algorithm,
        });
        setIsSearching(false);
        return;
      }

      // Get the state after phase 1 (all disks on B)
      let stateAfterPhase1: State = [
        ...initialState.map((rod) => [...rod]),
      ] as State;
      for (const move of phase1.path) {
        const disk = stateAfterPhase1[move.from].pop()!;
        stateAfterPhase1[move.to].push(disk);
      }

      // Phase 2: B → C
      const phase2 = solveFunc(stateAfterPhase1, "C");

      if (!phase2) {
        setSolution({
          error: "No solution found for B → C",
          path: [],
          nodesExplored: 0,
          algorithm,
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
        tree: phase1.tree, // show phase1 tree for complete
      };

      setSolution(completeSolution);
      setIsSearching(false);
    }, 100);
  };

  const handleSolve = (algorithm: "BFS" | "DFS"): void => {
    solveComplete(algorithm);
  };

  // Solve single phase (A→B or B→C)
  

  const renderRods = (state: State): JSX.Element => {
    const [rodA, rodB, rodC] = state;
    const rodNames: string[] = ["A", "B", "C"];
    const rods: Rod[] = [rodA, rodB, rodC];

    return (
      <div className="flex justify-center items-end gap-12 pb-8">
        {rods.map((rod, rodIndex) => (
          <div key={rodIndex} className="flex flex-col items-center">
            <div className="text-2xl font-bold mb-4 text-indigo-800 bg-indigo-50 px-4 py-2 rounded-full shadow-sm">
              {rodNames[rodIndex]}
            </div>
            <div className="relative">
              {/* Rod pole with gradient */}
              <div className="w-3 h-40 bg-gradient-to-b from-amber-600 to-amber-800 mx-auto rounded-t-lg shadow-lg"></div>
              {/* Base with shadow */}
              <div className="w-24 h-4 bg-gradient-to-b from-amber-800 to-amber-900 -mt-1 rounded-lg shadow-lg"></div>
              {/* Disks */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex flex-col-reverse">
                {rod.map((disk, diskIndex) => {
                  const width = 12 + disk * 10;
                  const colors = [
                    "bg-gradient-to-b from-red-400 to-red-600",
                    "bg-gradient-to-b from-blue-400 to-blue-600", 
                    "bg-gradient-to-b from-green-400 to-green-600",
                    "bg-gradient-to-b from-purple-400 to-purple-600",
                  ];
                  return (
                    <div
                      key={diskIndex}
                      className={`h-5 rounded-lg ${
                        colors[disk - 1]
                      } border-2 border-gray-800 mb-1 shadow-lg transform hover:scale-105 transition-transform duration-200`}
                      style={{
                        width: `${width}px`,
                        marginLeft: `-${width / 2}px`,
                        marginRight: `-${width / 2}px`,
                      }}
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

    let state: State = [...initialState.map((rod) => [...rod])] as State;
    for (let i = 0; i < currentStep && i < solution.path.length; i++) {
      const move = solution.path[i];
      const disk = state[move.from].pop()!;
      state[move.to].push(disk);
    }
    return state;
  };

  const nextStep = (): void => {
    if (solution && currentStep < solution.path.length) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const prevStep = (): void => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const autoPlay = (): void => {
    if (!solution) return;

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
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
      const node: NodeGraphNode = {
        state: move.state,
        move: move.move,
        children: [],
      };
      current.children.push(node);
      current = node;
    }
    return root;
  };

  // --- Enhanced NodeGraph visualization ---
  const renderStateAsLetters = (state: State): string => {
    const [rodA, rodB, rodC] = state;
    let result = "";
    // Changed loop to go from 1 to 4 (smallest to largest)
    for (let disk = 1; disk <= 4; disk++) {
      if (rodA.includes(disk)) result += "a";
      else if (rodB.includes(disk)) result += "b";
      else if (rodC.includes(disk)) result += "c";
    }
    return result;
  };

  interface TreeNode {
    state: State;
    stateStr: string;
    isChosen: boolean;
    children: TreeNode[];
    level: number; // depth in tree
    position: number; // horizontal position
    step?: number; // step in solution path if part of solution
  }

  const NodeGraph: React.FC<{
    root: NodeGraphNode;
    highlightStep?: number;
  }> = ({ root, highlightStep }) => {
    const buildTreeInfo = (
      node: NodeGraphNode,
      level: number = 0,
      position: number = 0
    ): TreeNode => {
      const allMoves = getValidMoves(node.state);
      const chosenChild = node.children.find(
        (child) => child.step !== undefined
      );
      const sortedMoves = allMoves.sort((a, b) =>
        renderStateAsLetters(a.state).localeCompare(
          renderStateAsLetters(b.state)
        )
      );

      // Calculate children positions to center them under parent
      const totalChildren = sortedMoves.length;
      const startPos = position - (totalChildren - 1) / 2;

      const children = sortedMoves.map((move, index) => {
        const childNode = node.children.find(
          (child) => stateToString(child.state) === stateToString(move.state)
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
          position: startPos + index,
        };
      });

      return {
        state: node.state,
        stateStr: renderStateAsLetters(node.state),
        isChosen: node.step !== undefined,
        children,
        level,
        position,
      };
    };

    const renderLines = (node: TreeNode): JSX.Element[] => {
      const nodeSize = { width: 64, height: 28 }; // Approximate node dimensions

      return node.children.flatMap((child) => {
        // Calculate start and end points
        const startX = node.position * 100;
        const startY = node.level * 60 + nodeSize.height / 2;
        const endX = child.position * 100;
        const endY = child.level * 60 + nodeSize.height / 2;

        return [
          <div
            key={`line-${node.stateStr}-${child.stateStr}`}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          >
            <svg
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                overflow: "visible",
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
          ...renderLines(child),
        ];
      });
    };

    const renderNode = (node: TreeNode): JSX.Element => {
      const isHighlighted =
        highlightStep !== undefined &&
        node.isChosen &&
        node.children.some(
          (child) => child.isChosen && child.step === highlightStep
        );
      const isCurrent =
        highlightStep !== undefined && node.step === highlightStep;

      return (
        <div
          style={{
            position: "absolute",
            left: `${node.position * 100}px`,
            top: `${node.level * 60}px`,
            transform: "translate(-50%, 0)",
            zIndex: 1,
          }}
        >
          <div
            className={`px-3 py-2 font-mono text-sm rounded-lg shadow-md ${
              isCurrent
                ? "bg-orange-200 border-2 border-orange-500 shadow-lg"
                : isHighlighted
                ? "bg-yellow-100 border-2 border-yellow-400"
                : node.isChosen
                ? "bg-green-50 border-2 border-green-400"
                : "bg-gray-50 border border-gray-200 text-gray-400"
            }`}
          >
            {node.stateStr}
          </div>
        </div>
      );
    };

    const getTreeDimensions = (
      node: TreeNode
    ): { width: number; height: number; minPos: number } => {
      const positions = new Set<number>();
      const levels = new Set<number>();

      const traverse = (n: TreeNode) => {
        positions.add(n.position);
        levels.add(n.level);
        n.children.forEach(traverse);
      };
      traverse(node);

      const minPos = Math.min(...Array.from(positions));
      const maxPos = Math.max(...Array.from(positions));
      const maxLevel = Math.max(...Array.from(levels));

      return {
        width: maxPos - minPos + 2,
        height: (maxLevel + 1) * 45,
        minPos,
      };
    };

    const treeInfo = buildTreeInfo(root);
    const dimensions = getTreeDimensions(treeInfo);

    return (
      <div className="w-full overflow-hidden">
        <div className="relative" style={{ height: `${dimensions.height}px` }}>
          <div
            style={{
              position: "absolute",
              left: "50%",
              transform: `translateX(-50%) scale(0.7)`,
              transformOrigin: "top",
              width: `${dimensions.width}px`,
            }}
          >
            {/* Lines layer */}
            {renderLines(treeInfo)}

            {/* Nodes layer */}
            {(() => {
              // Recursively render all nodes using renderNode
              const nodes: JSX.Element[] = [];
              const traverse = (n: TreeNode) => {
                nodes.push(renderNode(n));
                n.children.forEach(traverse);
              };
              traverse(treeInfo);
              return nodes;
            })()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header Section */}
      <div className="bg-white shadow-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-800 via-purple-700 to-indigo-900 bg-clip-text text-transparent mb-4">
              Tower of Hanoi Solver
            </h1>
            <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-full shadow-md">
              <span className="text-lg font-semibold text-indigo-800">اسم الطالب: محمد عبد الرسول حسن</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Main Content Grid */}
          {/* Controls Section */}
          <div className="bg-white mb-5 rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Search className="text-blue-600" size={24} />
                </div>
                <h3 className="text-2xl font-bold text-gray-800">
                  تنفيذ الحل الكامل
                </h3>
              </div>
              <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                اختر خوارزمية البحث لحل المسألة من A → B → C
              </p>
              
              <div className="flex flex-col sm:flex-row justify-center gap-6">
                <button
                  onClick={() => handleSolve("BFS")}
                  disabled={isSearching}
                  className="group relative px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                >
                  <div className="flex items-center justify-center gap-3">
                    <Search size={20} />
                    <span className="font-semibold text-lg">
                      {isSearching ? "جاري البحث..." : "BFS"}
                    </span>
                  </div>
                  {isSearching && (
                    <div className="absolute inset-0 bg-white bg-opacity-20 rounded-2xl animate-pulse"></div>
                  )}
                </button>
                
                <button
                  onClick={() => handleSolve("DFS")}
                  disabled={isSearching}
                  className="group relative px-8 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl hover:from-purple-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                >
                  <div className="flex items-center justify-center gap-3">
                    <BarChart3 size={20} />
                    <span className="font-semibold text-lg">
                      {isSearching ? "جاري البحث..." : "DFS"}
                    </span>
                  </div>
                  {isSearching && (
                    <div className="absolute inset-0 bg-white bg-opacity-20 rounded-2xl animate-pulse"></div>
                  )}
                </button>
              </div>
            </div>
          </div>

          

        {/* Solution Display */}
        {solution && !solution.error && (
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Success Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-8">
              <div className="text-center">
                <div className="inline-flex items-center gap-3 mb-4">
                  <div className="p-3 bg-white bg-opacity-20 rounded-full">
                    <Search className="text-white" size={24} />
                  </div>
                  <h2 className="text-3xl font-bold">
                    تم إيجاد الحل!
                  </h2>
                </div>
                <p className="text-xl text-green-100">
                  باستخدام خوارزمية {solution.algorithm}
                  {solution.totalMoves && ` - الحل الكامل: A → B → C`}
                  {solution.goal && ` - مرحلة: A → ${solution.goal}`}
                </p>
              </div>
            </div>

			{/* Tower Visualization */}
          <div className="bg-white rounded-3xl p-8 border border-gray-100">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">الحالة الحالية</h2>
              <div className="w-20 h-1 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full mx-auto"></div>
            </div>
            {renderRods(getCurrentState())}
          </div>

            <div className="p-8">
              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 text-center border border-blue-200">
                  <div className="text-4xl font-bold text-blue-600 mb-2">
                    {solution.totalMoves || solution.path.length}
                  </div>
                  <div className="text-sm font-semibold text-blue-700">العدد الكلي للحركات</div>
                </div>
                
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 text-center border border-green-200">
                  <div className="text-4xl font-bold text-green-600 mb-2">
                    {solution.nodesExplored}
                  </div>
                  <div className="text-sm font-semibold text-green-700">عدد ال Nodes المستكشفة</div>
                </div>
                
                {solution.phase1 && solution.phase2 && (
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 text-center border border-purple-200">
                    <div className="text-2xl font-bold text-purple-600 mb-2">
                      {solution.phase1.path.length} + {solution.phase2.path.length}
                    </div>
                    <div className="text-sm font-semibold text-purple-700">A→B + B→C</div>
                  </div>
                )}
              </div>

              {/* Animation Controls Section */}
              <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-2xl p-8 mb-8">
                <h3 className="text-xl font-bold text-center text-gray-800 mb-8">تحكم في التشغيل</h3>
                
                {/* Step Navigation */}
                <div className="flex justify-center items-center gap-8 mb-8">
                  <button
                    onClick={prevStep}
                    disabled={currentStep === 0}
                    className="flex items-center gap-3 px-6 py-3 bg-white text-slate-700 rounded-xl shadow-md hover:shadow-lg hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none transition-all duration-200 border border-slate-200"
                  >
                    <ChevronRight size={20} />
                    <span className="font-medium">السابق</span>
                  </button>
                  
                  <div className="flex flex-col items-center gap-4">
                    <div className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-lg">
                      <span className="text-xl font-bold">
                        الخطوة {currentStep} من {solution.path.length}
                      </span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-64 h-3 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500 ease-out shadow-sm"
                        style={{ width: `${((currentStep) / solution.path.length) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <button
                    onClick={nextStep}
                    disabled={currentStep >= solution.path.length}
                    className="flex items-center gap-3 px-6 py-3 bg-white text-slate-700 rounded-xl shadow-md hover:shadow-lg hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none transition-all duration-200 border border-slate-200"
                  >
                    <span className="font-medium">التالي</span>
                    <ChevronLeft size={20} />
                  </button>
                </div>

                {/* Speed and Auto-play Controls */}
                <div className="flex flex-col lg:flex-row justify-center items-center gap-8 p-6 bg-white rounded-2xl shadow-md border border-slate-200">
                  <div className="flex items-center gap-6">
                    <label className="text-sm font-semibold text-slate-600 min-w-max">
                      السرعة:
                    </label>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-slate-500">بطيء</span>
                      <div className="relative">
                        <input
                          type="range"
                          min="100"
                          max="1000"
                          step="50"
                          value={animationSpeed}
                          onChange={handleSpeedChange}
                          className="w-40 h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer slider"
                          style={{
                            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((animationSpeed - 100) / 900) * 100}%, #e2e8f0 ${((animationSpeed - 100) / 900) * 100}%, #e2e8f0 100%)`
                          }}
                        />
						{/* @ts-ignore */}
                        <style jsx>{`
                          .slider::-webkit-slider-thumb {
                            appearance: none;
                            width: 24px;
                            height: 24px;
                            border-radius: 50%;
                            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                            cursor: pointer;
                            border: 3px solid white;
                            box-shadow: 0 3px 8px rgba(0,0,0,0.3);
                          }
                          .slider::-moz-range-thumb {
                            width: 24px;
                            height: 24px;
                            border-radius: 50%;
                            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                            cursor: pointer;
                            border: 3px solid white;
                            box-shadow: 0 3px 8px rgba(0,0,0,0.3);
                          }
                        `}</style>
                      </div>
                      <span className="text-xs text-slate-500">سريع</span>
                    </div>
                    <div className="px-4 py-2 bg-slate-100 rounded-lg shadow-sm">
                      <span className="text-sm font-mono text-slate-600">{animationSpeed}ms</span>
                    </div>
                  </div>

                  <div className="h-6 w-px bg-slate-300 hidden lg:block"></div>

                  <button
                    onClick={autoPlay}
                    className={`flex items-center gap-3 px-8 py-4 rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
                      isAutoPlaying 
                        ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white hover:from-red-600 hover:to-pink-700' 
                        : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700'
                    }`}
                  >
                    {isAutoPlaying ? <Pause size={20} /> : <Play size={20} />}
                    <span>{isAutoPlaying ? 'إيقاف' : 'تشغيل تلقائي'}</span>
                  </button>
                </div>
              </div>

              {/* Current Move Display */}
              {currentStep > 0 && currentStep <= solution.path.length && (
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-amber-400 rounded-lg p-6 mb-8 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-amber-100 rounded-full">
                      <ChevronRight className="text-amber-600" size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-amber-800 text-lg">الحركة الحالية:</div>
                      <div className="text-amber-700 text-lg">{solution.path[currentStep - 1].move}</div>
                      {solution.phase1 && solution.phase2 && (
                        <div className="text-sm text-amber-600 mt-1">
                          {currentStep <= solution.phase1.path.length ? '(المرحلة الأولى: A→B)' : '(المرحلة الثانية: B→C)'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Node Graph Visualization */}
              <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl p-8">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">
                    Node Graph ({solution.algorithm})
                  </h3>
                  {/* <div className="flex justify-center mb-6">
                    <label className="flex items-center gap-3 cursor-pointer bg-white px-6 py-3 rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={showFullTree}
                        onChange={(e) => setShowFullTree(e.target.checked)}
                        className="form-checkbox h-5 w-5 text-blue-600 rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">Show Full Search Tree</span>
                    </label>
                  </div> */}
                </div>
                
                <div className="bg-white rounded-xl p-6 shadow-inner border-2 border-gray-100">
                  <NodeGraph
                    root={
                      showFullTree
                        ? solution.tree ?? { state: initialState, children: [] }
                        : buildNodeGraph(initialState, solution.path)
                    }
                    highlightStep={currentStep}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {solution && solution.error && (
          <div className="bg-white rounded-3xl shadow-xl border border-red-200 overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-8">
              <div className="text-center">
                <div className="text-3xl font-bold mb-2">خطأ في البحث</div>
                <p className="text-red-100 text-lg">{solution.error}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HanoiSolver;