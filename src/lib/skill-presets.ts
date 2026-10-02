import type { SkillDocument } from "@/lib/skills";
import type { SkillDependency } from "@/lib/skill-selection";

export type BuiltInSkillPreset = SkillDocument & { id: string };

export const BUILT_IN_SKILL_PRESETS: BuiltInSkillPreset[] = [
  {
    id: "web-research",
    name: "联网调研",
    description: "使用搜索 MCP 完成多来源检索、时间校验和结构化研究总结。",
    version: "1.0.0",
    keywords: ["搜索", "调研", "最新", "新闻", "资料", "search", "research", "news"],
    requiredMcp: ["Exa Search", "Tavily Search"],
    instructions: `# 联网调研工作流

1. 明确问题、时间范围、地区和需要交付的结论。
2. 优先使用已启用的搜索 MCP，至少检索两个相互独立的可靠来源。
3. 对时效性事实记录发布日期和事件发生日期，避免把旧信息当作最新状态。
4. 优先采用官方文档、原始公告、论文和一手数据；二手报道只用于补充背景。
5. 区分来源明确支持的事实、合理推断和仍待确认的信息。
6. 输出简洁结论，并把来源链接放在对应论断附近。`,
  },
  {
    id: "source-verification",
    name: "来源核验",
    description: "交叉核对关键说法、数字、日期与引用，标注证据强度和冲突。",
    version: "1.0.0",
    keywords: ["核实", "核验", "来源", "引用", "事实", "真假", "verify", "citation", "fact check"],
    requiredMcp: ["Exa Search", "Tavily Search"],
    instructions: `# 来源核验工作流

1. 把待核验内容拆成可独立判断的原子说法。
2. 为每条说法寻找最接近原始事实的权威来源，并记录发布日期。
3. 至少用一个独立来源交叉验证高影响结论；发现冲突时并列展示差异。
4. 检查数字单位、统计口径、样本范围、时区和引用上下文。
5. 使用“已证实、部分支持、证据不足、与来源冲突”标记结论。
6. 不补写来源没有表达的内容，也不把相关性描述成因果关系。`,
  },
  {
    id: "technical-docs",
    name: "技术文档检索",
    description: "针对框架、SDK 和 API 问题检索对应版本文档并给出可执行答案。",
    version: "1.0.0",
    keywords: ["文档", "API", "SDK", "框架", "库", "报错", "docs", "library", "framework", "error"],
    requiredMcp: ["Context7"],
    instructions: `# 技术文档检索工作流

1. 先确认技术栈、准确版本、运行环境和完整错误信息。
2. 使用 Context7 或官方文档检索当前版本的 API，不依赖过时记忆。
3. 核对废弃说明、迁移指南、参数默认值和平台差异。
4. 先给最小可验证方案，再补充边界条件与替代实现。
5. 代码示例应与用户现有语言、框架和包管理方式一致。
6. 标明未经实际运行验证的部分，并附上对应官方文档。`,
  },
  {
    id: "github-project-research",
    name: "GitHub 项目研究",
    description: "以只读方式分析仓库结构、Issues、Pull Requests 与项目健康度。",
    version: "1.0.0",
    keywords: ["GitHub", "仓库", "开源", "项目", "issue", "pull request", "repository", "repo"],
    requiredMcp: ["GitHub"],
    instructions: `# GitHub 项目研究工作流

1. 先确认目标仓库、分支或标签，以及用户关心的版本范围。
2. 从 README、发布记录、主要源码目录和配置文件建立项目结构视图。
3. 检查近期 Issues、Pull Requests、提交活跃度和维护者响应情况。
4. 区分已发布能力、主分支未发布变更和仅存在于讨论中的计划。
5. 安全与依赖结论应引用具体公告、提交或文件，不从星标数量推断质量。
6. 默认只读；任何写入仓库、创建 Issue 或修改 PR 的动作都需要用户明确确认。`,
  },
];

export type SkillCatalogEntry = BuiltInSkillPreset & {
  category: "research" | "productivity" | "writing" | "learning";
  author: string;
  descriptionEn: string;
  sourceUrl: string;
  changeNotes: string;
  estimatedInput: string;
  estimatedOutput: string;
  dependencies: SkillDependency[];
  legacyInstalled: boolean;
};

const CATALOG_BASE_URL =
  "https://github.com/free2way/ai2dot/tree/main/src/lib/skill-presets.ts";

const catalogMetadata: Record<
  string,
  Omit<
    SkillCatalogEntry,
    keyof BuiltInSkillPreset | "author" | "sourceUrl" | "legacyInstalled"
  >
> = {
  "web-research": {
    category: "research",
    descriptionEn: "Research current topics across independent web sources.",
    changeNotes: "Initial curated workflow with source and date checks.",
    estimatedInput: "800-1,800 tokens",
    estimatedOutput: "600-1,500 tokens",
    dependencies: [
      {
        capability: "web_search",
        requirement: "required",
        alternatives: ["exa", "tavily"],
      },
    ],
  },
  "source-verification": {
    category: "research",
    descriptionEn: "Verify claims, numbers, dates, and citations against evidence.",
    changeNotes: "Initial claim-by-claim verification workflow.",
    estimatedInput: "700-1,600 tokens",
    estimatedOutput: "500-1,200 tokens",
    dependencies: [
      {
        capability: "web_search",
        requirement: "optional",
        alternatives: ["exa", "tavily"],
      },
    ],
  },
  "technical-docs": {
    category: "research",
    descriptionEn: "Answer framework and API questions from versioned documentation.",
    changeNotes: "Initial version-aware documentation workflow.",
    estimatedInput: "700-1,500 tokens",
    estimatedOutput: "500-1,200 tokens",
    dependencies: [
      {
        capability: "technical_docs",
        requirement: "required",
        alternatives: ["context7"],
      },
    ],
  },
  "github-project-research": {
    category: "research",
    descriptionEn: "Inspect repositories, issues, pull requests, and project health.",
    changeNotes: "Initial read-only repository research workflow.",
    estimatedInput: "800-1,700 tokens",
    estimatedOutput: "600-1,500 tokens",
    dependencies: [
      {
        capability: "github_read",
        requirement: "required",
        alternatives: ["github"],
      },
    ],
  },
};

const additionalCatalogSkills: BuiltInSkillPreset[] = [
  {
    id: "context-review",
    name: "上下文整理",
    description: "把当前对话中的决策、事实、分歧和待办整理为可继续执行的上下文。",
    version: "1.0.0",
    keywords: ["上下文", "整理", "决策", "待办", "context", "decisions"],
    requiredMcp: [],
    instructions: `# 上下文整理工作流

1. 只基于本次提供的可用对话上下文，不补写没有出现的事实。
2. 分别提取目标、已确认事实、关键决策、未决问题、风险与下一步行动。
3. 对互相冲突的说法并列记录，标明仍需确认，不能擅自选择其中一个版本。
4. 行动项应包含负责人、截止时间和验收结果；上下文没有提供时明确写“待确认”。
5. 输出结构化 Markdown，先给简短摘要，再给可直接用于继续会话的上下文清单。`,
  },
  {
    id: "meeting-actions",
    name: "会议行动项",
    description: "从会议记录中提取决定、负责人、期限、依赖和后续检查点。",
    version: "1.0.0",
    keywords: ["会议", "纪要", "行动项", "负责人", "meeting", "action items"],
    requiredMcp: [],
    instructions: `# 会议行动项工作流

1. 区分讨论、提议、明确决定和行动项，不把开放讨论误写为最终决定。
2. 每个行动项提取任务、负责人、截止时间、依赖和完成标准；缺失字段标记待确认。
3. 合并重复任务，但保留不同负责人与不同期限之间的冲突。
4. 单独列出需要会后确认的问题、被阻塞事项和下一次检查时间。
5. 输出先给三行内会议结论，再给 Markdown 表格和按优先级排列的后续清单。`,
  },
  {
    id: "document-brief",
    name: "文档摘要",
    description: "把长文档压缩为结论、证据、限制条件和可执行建议。",
    version: "1.0.0",
    keywords: ["文档", "摘要", "报告", "总结", "document", "brief"],
    requiredMcp: [],
    instructions: `# 文档摘要工作流

1. 识别文档目的、目标读者、核心论点和主要证据，不只复述目录。
2. 对数字、日期、定义和限制条件保留原始口径；无法从来源确认时不自行补全。
3. 区分作者明确陈述、引用事实和你的推断，并指出可能影响结论的缺失信息。
4. 提取用户可采取的行动、前置条件和风险，避免空泛建议。
5. 输出包括执行摘要、关键知识点、证据与限制、建议行动和需要追问的问题。`,
  },
  {
    id: "video-study",
    name: "视频学习笔记",
    description: "基于已提供字幕整理章节、知识点、术语、问题与复习卡片。",
    version: "1.0.0",
    keywords: ["视频", "字幕", "学习", "笔记", "video", "transcript"],
    requiredMcp: [],
    instructions: `# 视频学习笔记工作流

1. 仅根据用户提供或知识库检索到的字幕与元数据处理，不声称观看了无法访问的视频。
2. 按主题变化建立章节；有时间戳时保留，没有时间戳时不要编造。
3. 为每章提取关键概念、定义、例子、论证链和容易误解的点。
4. 对讲者观点与可验证事实做区分，标出需要外部核验的说法。
5. 输出详细学习报告、术语表、复习问题、闪卡和可保存到知识库的 Markdown 摘要。`,
  },
];

const additionalMetadata: Record<
  string,
  Omit<
    SkillCatalogEntry,
    keyof BuiltInSkillPreset | "author" | "sourceUrl" | "legacyInstalled"
  >
> = {
  "context-review": {
    category: "productivity",
    descriptionEn: "Turn available conversation context into decisions and next actions.",
    changeNotes: "Initial context synthesis workflow.",
    estimatedInput: "500-1,200 tokens",
    estimatedOutput: "400-1,000 tokens",
    dependencies: [],
  },
  "meeting-actions": {
    category: "productivity",
    descriptionEn: "Extract accountable action items from meeting notes.",
    changeNotes: "Initial meeting follow-up workflow.",
    estimatedInput: "500-1,300 tokens",
    estimatedOutput: "400-900 tokens",
    dependencies: [],
  },
  "document-brief": {
    category: "writing",
    descriptionEn: "Create an evidence-aware brief from a long document.",
    changeNotes: "Initial structured briefing workflow.",
    estimatedInput: "700-1,600 tokens",
    estimatedOutput: "500-1,200 tokens",
    dependencies: [],
  },
  "video-study": {
    category: "learning",
    descriptionEn: "Convert supplied transcripts into detailed study notes.",
    changeNotes: "Initial transcript-based learning workflow.",
    estimatedInput: "700-1,700 tokens",
    estimatedOutput: "600-1,500 tokens",
    dependencies: [],
  },
};

export const SKILL_CATALOG: SkillCatalogEntry[] = [
  ...BUILT_IN_SKILL_PRESETS.map((skill) => ({
    ...skill,
    ...catalogMetadata[skill.id],
    author: "AI2DOT",
    sourceUrl: CATALOG_BASE_URL,
    legacyInstalled: true,
  })),
  ...additionalCatalogSkills.map((skill) => ({
    ...skill,
    ...additionalMetadata[skill.id],
    author: "AI2DOT",
    sourceUrl: CATALOG_BASE_URL,
    legacyInstalled: false,
  })),
];

export function getSkillCatalogEntry(catalogId: string, version?: string) {
  return SKILL_CATALOG.find(
    (entry) =>
      entry.id === catalogId && (!version || entry.version === version),
  );
}
