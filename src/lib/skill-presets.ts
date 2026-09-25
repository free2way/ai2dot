import type { SkillDocument } from "@/lib/skills";

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
