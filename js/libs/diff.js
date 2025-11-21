/**
 * myers algorithm
 *
 * -1: number of deleted characters
 *  0: number of matched characters
 *  1: number of inserted characters
 *
 * @example
 * const result = getDiffs("Lorem", "ore"); // [[-1, "L"], [0, "ore"], [-1, "m"]]
 */
export function getDiffs(from, to) {
  const backtrack = function (from, to, trace, d) {
    const result = [];

    let x = from.length;
    let y = to.length;
    const max = from.length + to.length;

    let currentOp = null;
    let currentStr = "";

    const push = (op, char) => {
      if (currentOp === op) {
        currentStr = char + currentStr;
      } else {
        if (currentOp !== null && currentStr) {
          result.push([currentOp, currentStr]);
        }
        currentOp = op;
        currentStr = char;
      }
    };

    for (let depth = d; depth >= 0; depth--) {
      const v = trace[depth];
      const k = x - y;

      let prevK;

      if (k === -depth || (k !== depth && v[k - 1 + max] < v[k + 1 + max])) {
        prevK = k + 1;
      } else {
        prevK = k - 1;
      }

      const prevX = v[prevK + max];
      const prevY = prevX - prevK;

      // diagonal move (match)
      while (x > prevX && y > prevY) {
        x--;
        y--;
        push(0, from[x]);
      }

      if (depth === 0) break;

      // vertical move (insertion)
      if (x === prevX) {
        y--;
        push(1, to[y]);
      }
      // horizontal move (deletion)
      else {
        x--;
        push(-1, from[x]);
      }
    }

    if (currentOp !== null && currentStr) {
      result.push([currentOp, currentStr]);
    }

    return result.reverse();
  };

  const n = from.length;
  const m = to.length;
  const max = n + m;

  const v = Array(2 * max + 1).fill(0);
  const trace = [];

  for (let d = 0; d <= max; d++) {
    trace.push([...v]);

    for (let k = -d; k <= d; k += 2) {
      let x;

      if (k === -d || (k !== d && v[k - 1 + max] < v[k + 1 + max])) {
        x = v[k + 1 + max];
      } else {
        x = v[k - 1 + max] + 1;
      }

      let y = x - k;

      while (x < n && y < m && from[x] === to[y]) {
        x++;
        y++;
      }

      v[k + max] = x;

      if (x >= n && y >= m) {
        return backtrack(from, to, trace, d);
      }
    }
  }

  return [];
}
/**
 * @example
 * const a = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
 * const b = "sit amet, adipiscing";
 * const result = matchStrings(a, b);
 * // {
 * //   matchRate: 0.35714285714285715,
 * //   similarity: 0.35714285714285715,
 * //   diceSimilarity: 0.5263157894736842,
 * //   jaccardSimilarity: 0.35714285714285715,
 * //   distance: 36,
 * //   normalizedDistance: 0.6428571428571429,
 * //   matches: 20,
 * //   insertions: 0,
 * //   deletions: 36
 * // }
 */
export function matchStrings(from, to) {
  const diff = getDiffs(from, to);

  let matches = 0;
  let insertions = 0;
  let deletions = 0;

  for (const [op, str] of diff) {
    const len = str.length;
    if (op === 0) {
      matches += len;
    } else if (op === 1) {
      insertions += len;
    } else {
      deletions += len;
    }
  }

  const totalOperations = matches + insertions + deletions;

  return {
    matchRate: totalOperations > 0 ? matches / totalOperations : 1,

    similarity:
      Math.max(from.length, to.length) > 0
        ? matches / Math.max(from.length, to.length)
        : 1,

    diceSimilarity:
      from.length + to.length > 0
        ? (2 * matches) / (from.length + to.length)
        : 1,

    jaccardSimilarity:
      from.length + to.length - matches > 0
        ? matches / (from.length + to.length - matches)
        : 1,

    distance: insertions + deletions,

    normalizedDistance:
      Math.max(from.length, to.length) > 0
        ? (insertions + deletions) / Math.max(from.length, to.length)
        : 0,

    matches,
    insertions,
    deletions,
  };
}