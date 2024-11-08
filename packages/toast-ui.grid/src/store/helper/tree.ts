import { GridId } from '@t/store';
import { OptRow } from '@t/options';
import { Row, RowKey } from '@t/store/data';
import { Column } from '@t/store/column';
import { createRawRow } from '../data';
import { isExpanded, getDepth, isLeaf, isHidden } from '../../query/tree';
import { observable, observe } from '../../helper/observable';
import { includes, isUndefined, someProp } from '../../helper/common';
import { TREE_INDENT_WIDTH } from '../../helper/constant';

interface TreeDataOption {
  keyColumnName?: string;
  lazyObservable?: boolean;
  offset?: number;
  disabled?: boolean;
}

interface TreeDataCreationOption {
  id: number;
  data: OptRow[];
  column: Column;
  keyColumnName?: string;
  lazyObservable?: boolean;
  disabled?: boolean;
}

interface TreeRowKeyMap {
  [id: number]: number;
}

const treeRowKeyMap: TreeRowKeyMap = {};

export function clearTreeRowKeyMap(id: GridId) {
  delete treeRowKeyMap[id];
}

function generateTreeRowKey(id: GridId) {
  treeRowKeyMap[id] = treeRowKeyMap[id] ?? -1;

  treeRowKeyMap[id] += 1;

  return treeRowKeyMap[id];
}

function addChildRowKey(row: Row, childRow: Row) {
  const { tree } = row._attributes;
  const { rowKey } = childRow;

  if (tree && !includes(tree.childRowKeys, rowKey)) {
    tree.childRowKeys.push(rowKey);
  }
  if (!someProp('rowKey', rowKey, row._children!)) {
    row._children!.push(childRow);
  }
  row._leaf = false;
}

function insertChildRowKey(row: Row, childRow: Row, offset: number) {
  const { tree } = row._attributes;
  const { rowKey } = childRow;

  if (tree && !includes(tree.childRowKeys, rowKey)) {
    tree.childRowKeys.splice(offset, 0, rowKey);
  }
  if (!someProp('rowKey', rowKey, row._children!)) {
    row._children!.splice(offset, 0, childRow);
  }
  row._leaf = false;
}

function getTreeCellInfo(rawData: Row[], row: Row, treeIndentWidth?: number, useIcon?: boolean) {
  const depth = getDepth(rawData, row);
  const indentWidth = getTreeIndentWidth(depth, treeIndentWidth, useIcon);

  return {
    depth,
    indentWidth,
    leaf: isLeaf(row),
    expanded: isExpanded(row),
  };
}

export function createTreeRawRow(
  id: number,
  row: OptRow,
  parentRow: Row | null,
  column: Column,
  options = {} as TreeDataOption
) {
  let childRowKeys = [] as RowKey[];
  if (row._attributes && row._attributes.tree) {
    childRowKeys = row._attributes.tree.childRowKeys as RowKey[];
  }
  const { keyColumnName, offset, lazyObservable = false, disabled = false } = options;

  if (!row._children) {
    row._children = [];
    row._leaf = true;
  }
  // generate new tree rowKey when row doesn't have rowKey
  const targetTreeRowKey = isUndefined(row.rowKey) ? generateTreeRowKey(id) : Number(row.rowKey);
  const rawRow = createRawRow(id, row, targetTreeRowKey, column, {
    keyColumnName,
    lazyObservable,
    disabled,
  });
  const defaultAttributes = {
    parentRowKey: parentRow ? parentRow.rowKey : null,
    childRowKeys,
    hidden: parentRow ? !isExpanded(parentRow) || isHidden(parentRow) : false,
  };

  if (parentRow) {
    if (!isUndefined(offset)) {
      insertChildRowKey(parentRow, rawRow, offset);
    } else {
      addChildRowKey(parentRow, rawRow);
    }
  }

  const tree = {
    ...defaultAttributes,
    expanded: row._attributes!.expanded,
  };

  rawRow._attributes.tree = lazyObservable ? tree : observable(tree);

  return rawRow;
}

// modify by liq 避免层级过多时报Maximum call stack size exceeded的错误
// export function flattenTreeData(
//   id: number,
//   data: OptRow[],
//   parentRow: Row | null,
//   column: Column,
//   options: TreeDataOption
// ) {
//   const flattenedRows: Row[] = [];

//   data.forEach((row) => {
//     const rawRow = createTreeRawRow(id, row, parentRow, column, options);

//     flattenedRows.push(rawRow);

//     if (Array.isArray(row._children)) {
//       if (row._children.length) {
//         flattenedRows.push(...flattenTreeData(id, row._children, rawRow, column, options));
//       }
//     }
//   });

//   return flattenedRows;
// }

// function trampoline(fn: (...args: any[]) => any) {
//   return function (...args: any[]) {
//     let result = fn(...args);
//     while (typeof result === 'function') {
//       result = result();
//     }
//     return result;
//   };
// }
// export function flattenTreeData(
//   id: number,
//   data: OptRow[],
//   parentRow: Row | null,
//   column: Column,
//   options: TreeDataOption
// ): Row[] {
//   const flattenedRows: Row[] = [];
//   const processRow = (row: OptRow, parent: Row | null): Row | null => {
//     const rawRow = createTreeRawRow(id, row, parent, column, options);
//     flattenedRows.push(rawRow);
//     // 返回处理后的行
//     return rawRow;
//   };
//   const traverse = (rows: OptRow[]): (() => Row[] | null) | null => {
//     let index = 0;
//     const next = (): Row[] | null => {
//       if (index >= rows.length) {
//         return null;
//       }
//       const row = rows[(index += 1)];
//       const result = processRow(row, parentRow);
//       if (result) {
//         // 处理孩子行
//         const childrenResult = row._children
//           ? flattenTreeData(id, row._children as OptRow[], result, column, options)
//           : null;
//         if (childrenResult) {
//           flattenedRows.push(...childrenResult);
//         }
//         // 返回下一步的处理
//         return next();
//       }
//       // 如果没有结果，继续下一步
//       return next();
//     };
//     return next;
//   };
//   const initialCall = traverse(data);
//   trampoline(() => {
//     if (initialCall) {
//       // 处理初始调用并确保返回数组
//       return initialCall() || [];
//     }
//     // 没有初始调用时返回空数组
//     return [];
//   })();
//   return flattenedRows;
// }

// function trampoline(fn: (...args: any[]) => any) {
//   return function (...args: any[]) {
//     let result = fn(...args);
//     while (typeof result === 'function') {
//       result = result();
//     }
//     return result;
//   };
// }
// export function flattenTreeData(
//   id: number,
//   data: OptRow[],
//   parentRow: Row | null,
//   column: Column,
//   options: TreeDataOption
// ): Row[] {
//   const flattenedRows: Row[] = [];
//   const processRow = (row: OptRow, parent: Row | null): Row => {
//     const rawRow = createTreeRawRow(id, row, parent, column, options);
//     flattenedRows.push(rawRow);
//     return rawRow;
//   };
//   const traverse = (rows: OptRow[]): (() => Row[] | null) | null => {
//     // 初始化为 -1
//     let index = -1;
//     const next = (): Row[] | null => {
//       // 在访问之前自增
//       index++;
//       if (index >= rows.length) {
//         // 处理完所有行后返回 null
//         return null;
//       }
//       // 现在可以安全地访问当前行
//       const row = rows[index];
//       const result = processRow(row, parentRow);
//       // 处理子节点
//       if (row._children) {
//         const childrenResult = flattenTreeData(
//           id,
//           row._children as OptRow[],
//           result,
//           column,
//           options
//         );
//         if (childrenResult) {
//           // 合并子节点的结果
//           // 达到7层深度时还是会在此处报错：Maximum call stack size exceeded
//           flattenedRows.push(...childrenResult);
//         }
//       }
//       // 继续处理下一行
//       return next();
//     };
//     // 返回用于处理下一行的函数
//     return next;
//   };
//   const initialCall = traverse(data);
//   trampoline(() => {
//     if (initialCall) {
//       return initialCall() || [];
//     }
//     return [];
//   })();
//   return flattenedRows;
// }

export function flattenTreeData(
  id: number,
  data: OptRow[],
  parentRow: Row | null,
  column: Column,
  options: TreeDataOption
): Row[] {
  const flattenedRows: Row[] = [];
  const stack: { row: OptRow; parent: Row | null }[] = [];
  // 使用 unshift 反向推入根节点，[n, n-1, ..., 2, 1, 0]，保证处理顺序从0开始pop
  for (const row of data) {
    stack.unshift({ row, parent: parentRow });
  }
  while (stack.length) {
    // pop 最后推入的节点
    const { row, parent } = stack.pop()!;
    const rawRow = createTreeRawRow(id, row, parent, column, options);
    flattenedRows.push(rawRow);
    // 反向推入子节点，[n, n-1, ..., 2, 1, 0]，确保下次 pop 时顺序正确
    if (row._children) {
      for (let i = row._children.length - 1; i >= 0; i--) {
        stack.push({ row: row._children[i], parent: rawRow });
      }
    }
  }

  return flattenedRows;
}

export function createTreeRawData({
  id,
  data,
  column,
  keyColumnName,
  lazyObservable = false,
  disabled = false,
}: TreeDataCreationOption) {
  // only reset the rowKey on lazy observable data
  if (lazyObservable) {
    treeRowKeyMap[id] = -1;
  }

  return flattenTreeData(id, data, null, column, {
    keyColumnName,
    lazyObservable,
    disabled,
  });
}

export function createTreeCellInfo(
  rawData: Row[],
  row: Row,
  treeIndentWidth?: number,
  useIcon?: boolean,
  lazyObservable = false
) {
  const treeCellInfo = getTreeCellInfo(rawData, row, treeIndentWidth, useIcon);
  const treeInfo = lazyObservable ? treeCellInfo : observable(treeCellInfo);

  if (!lazyObservable) {
    observe(() => {
      treeInfo.expanded = isExpanded(row);
      treeInfo.leaf = isLeaf(row);
    });
  }

  return treeInfo;
}

export function getTreeIndentWidth(depth: number, treeIndentWidth?: number, showIcon?: boolean) {
  const indentWidth = treeIndentWidth ?? TREE_INDENT_WIDTH;
  return TREE_INDENT_WIDTH + (depth - 1) * indentWidth + (showIcon ? TREE_INDENT_WIDTH : 0);
}
