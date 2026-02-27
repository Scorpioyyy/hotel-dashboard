/**
 * 引用标记解析工具
 *
 * 将模型输出的 [[ref:N]] / [[ref:N,M]] 标记替换为 Markdown inline code 占位符，
 * 供 react-markdown 的自定义 code 组件拦截并渲染为 CitationBadge。
 */

// 匹配完整引用标记（兼容中文逗号和多余空格），可选吸收尾随的"等"字
const CITATION_REGEX = /\[\[ref:\s*(\d+(?:\s*[,，]\s*\d+)*)\s*\]\](等)?/g;

/**
 * 预处理内容：将 [[ref:N,M]] 替换为 `@@cite:N,M@@`（Markdown inline code）
 *
 * @param content  原始内容字符串
 * @param streaming  是否处于流式输出中（为 true 时会截断末尾未闭合的标记）
 * @returns 预处理后的字符串
 */
export function preprocessCitations(content: string, streaming: boolean = false): string {
  let processable = content;

  if (streaming) {
    // 检查末尾是否有未闭合的 [[ ... （没有匹配的 ]]）
    const lastOpen = processable.lastIndexOf('[[');
    if (lastOpen !== -1) {
      const afterOpen = processable.substring(lastOpen);
      if (!afterOpen.includes(']]')) {
        // 未闭合的标记——截断，等下一个 chunk 补齐
        processable = processable.substring(0, lastOpen);
      }
    }
  }

  // 替换完整标记为 inline code 占位符（有"等"时附加 :etc 后缀）
  return processable.replace(CITATION_REGEX, (_, nums: string, etc?: string) => {
    // 标准化：去空格、中文逗号转英文逗号
    const normalized = nums.replace(/\s/g, '').replace(/，/g, ',');
    const suffix = etc ? ':etc' : '';
    return `\`@@cite:${normalized}${suffix}@@\``;
  });
}

/**
 * 验证引用序号是否在合法范围内
 *
 * @param refs  引用序号数组（1-based）
 * @param referenceCount  实际参考评论条数
 * @returns 仅包含合法序号的数组
 */
export function validateRefs(refs: number[], referenceCount: number): number[] {
  return refs.filter(n => Number.isInteger(n) && n >= 1 && n <= referenceCount);
}
