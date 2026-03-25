const baseThemeDisplayMetadata = {
  "hexo:landscape": {
    tags: ["经典双栏", "快速上手", "熟悉感强"],
    positioningCopy: "Landscape 适合先把博客搭起来，再慢慢补品牌和内容结构。",
  },
  "hexo:next": {
    tags: ["秩序感", "参数成熟", "长期维护"],
    positioningCopy: "Next 更像稳健的主编辑室，适合想把导航、结构和扩展一步步做细的人。",
  },
  "hexo:butterfly": {
    tags: ["视觉活力", "封面感", "社区常用"],
    positioningCopy: "Butterfly 适合希望首页更有展示感、又想保留成熟生态支持的博客。",
  },
  "hexo:fluid": {
    tags: ["编辑感首页", "长文友好", "品牌留白"],
    positioningCopy: "如果你想先把封面气质和长文阅读感做稳，Fluid 是最顺手的起点。",
  },
  "hexo:volantis": {
    tags: ["门户分区", "模块丰富", "信息密度"],
    positioningCopy: "Volantis 适合内容块较多、希望首页像专题编排台一样组织信息的博客。",
  },
  "hugo:papermod": {
    tags: ["极简专注", "加载轻快", "文档型博客"],
    positioningCopy: "PaperMod 适合把内容本身放到最前面，尤其适合说明文、教程和周报。",
  },
  "hugo:loveit": {
    tags: ["现代感", "功能完整", "分享友好"],
    positioningCopy: "LoveIt 在现代外观和常用功能之间很均衡，适合作为长期经营型博客底板。",
  },
  "hugo:stack": {
    tags: ["杂志布局", "分栏阅读", "内容编排"],
    positioningCopy: "Stack 适合把栏目、侧栏和长文阅读一起经营，做出更像刊物的秩序感。",
  },
  "hugo:mainroad": {
    tags: ["传统博客", "清晰栏目", "稳定耐看"],
    positioningCopy: "Mainroad 更偏经典博客节奏，适合想用低学习成本维持清晰更新流的人。",
  },
  "hugo:anatole": {
    tags: ["个人名片", "侧栏形象", "作者表达"],
    positioningCopy: "Anatole 会先强调作者形象与个人简介，适合个人品牌和作品型博客。",
  },
};

export const themeDisplayMetadata = Object.freeze(
  Object.fromEntries(
    Object.entries(baseThemeDisplayMetadata).map(([key, value]) => [
      key,
      Object.freeze({
        tags: Object.freeze([...value.tags]),
        positioningCopy: value.positioningCopy,
      }),
    ]),
  ),
);

export function getThemeDisplayMetadata(framework, themeId) {
  return themeDisplayMetadata[`${framework}:${themeId}`] || null;
}
