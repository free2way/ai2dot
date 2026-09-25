import { APP_URL, type FeatureItem, type PricingTier, type UseCaseItem, type FaqItem } from "./marketing-types";

export { APP_URL };

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "free",
    name: "Starter 体验版",
    nameEn: "Starter Tier",
    tagline: "为个人创作者与技术尝鲜者提供开箱即用的极简 AI 体验",
    taglineEn: "Out-of-the-box exploration for solo engineers and AI tinkerers",
    priceMonthly: 0,
    priceAnnual: 0,
    popular: false,
    ctaText: "免费开始体验",
    ctaTextEn: "Start for Free",
    ctaHref: APP_URL,
    features: [
      "即刻免配置体验主流顶尖大模型",
      "单会话非覆盖式分支体验",
      "会话历史浏览器本地保存",
      "社区技术交流与文档支持",
      "自适应现代暗色/暖白响应式界面",
    ],
    featuresEn: [
      "Zero-config access to frontier LLMs",
      "Single-session thought tree branching",
      "Local browser storage persistence",
      "Community technical documentation support",
      "Adaptive dark/light responsive interface",
    ],
    specs: {
      workspaces: "单人本地体验",
      workspacesEn: "Single local session",
      models: "精选基础体验模型",
      modelsEn: "Curated basic models",
      branching: "最多 3 个分支 / 会话",
      branchingEn: "Up to 3 branches / session",
      knowledgeStorage: "不支持云端上传",
      knowledgeStorageEn: "Local ephemeral only",
      ragLimit: "暂无",
      ragLimitEn: "None",
      byok: false,
      auditLog: false,
      support: "社区开源支持",
      supportEn: "Community support",
    },
  },
  {
    id: "pro",
    name: "Pro 专业版",
    nameEn: "Pro Tier",
    tagline: "面向独立工程师、研究员与顾问的生产力全能利器",
    taglineEn: "All-in-one productivity suite for engineers, researchers, and consultants",
    priceMonthly: 19,
    priceAnnual: 15,
    popular: true,
    ctaText: "立即升级 Pro",
    ctaTextEn: "Get Started Pro",
    ctaHref: APP_URL,
    features: [
      "云端会话多端同步（Neon PostgreSQL）",
      "无限树状会话分支与多模型平行比对",
      "支持 BYOK（自带各大主流模型 API 密钥）",
      "AES-256-GCM 硬件级密钥端到端加密",
      "企业知识库导入（PDF / DOCX / TXT 等）",
      "基于 pg_trgm 混合候选召回与重排 RAG",
      "毫秒级生成幂等引擎与回放，零重复扣费",
    ],
    featuresEn: [
      "Cloud session sync across devices (Neon PostgreSQL)",
      "Infinite tree thought branching with multi-model compare",
      "Universal BYOK support (OpenAI, Claude, DeepSeek)",
      "Hardware-grade AES-256-GCM authenticated key encryption",
      "Knowledge base ingestion (PDF, DOCX, TXT, Markdown)",
      "Hybrid candidate retrieval & re-ranking RAG",
      "Sub-second request idempotency engine & replay",
    ],
    specs: {
      workspaces: "个人独享云端工作区",
      workspacesEn: "Dedicated personal cloud workspace",
      models: "全量模型 + 自定义兼容 API",
      modelsEn: "All frontier models + custom OpenAI APIs",
      branching: "无限制深度分支",
      branchingEn: "Unlimited thought branch depth",
      knowledgeStorage: "50 篇云端文档分块",
      knowledgeStorageEn: "50 cloud document chunks",
      ragLimit: "每次对话精准检索 10 条来源",
      ragLimitEn: "10 high-precision citations per turn",
      byok: true,
      auditLog: false,
      support: "工作日 24 小时邮件响应",
      supportEn: "24-hour weekday email response",
    },
  },
  {
    id: "team",
    name: "Team 团队版",
    nameEn: "Team Tier",
    tagline: "为敏捷团队与研发创新部门打造的 AI 协同工作台",
    taglineEn: "Collaborative AI command center built for agile engineering departments",
    priceMonthly: 49,
    priceAnnual: 39,
    popular: false,
    ctaText: "开启团队协同",
    ctaTextEn: "Launch Team Workspace",
    ctaHref: APP_URL,
    features: [
      "包含所有 Pro 专业版全部特性",
      "多租户隔离的团队共享工作区（Workspaces）",
      "共享专属 AI 智能体（Assistants）与 Prompt 库",
      "团队统一知识库，多层级权限访问管控",
      "30 天 Token 消耗、耗时、成本及健康大盘",
      "分钟级窗口分布式原子限流，保障多并发",
      "统一企业对公结算与发票凭据",
    ],
    featuresEn: [
      "Everything included in Pro tier",
      "Multi-tenant isolated team workspaces",
      "Shared enterprise AI assistants & prompt library",
      "Unified team knowledge base with RBAC permissions",
      "30-day token consumption, latency, & cost telemetry",
      "Distributed atomic sliding-window rate limiting",
      "Consolidated enterprise billing & receipts",
    ],
    specs: {
      workspaces: "团队多成员共享工作区",
      workspacesEn: "Shared multi-member workspace",
      models: "全量模型 + 企业自建模型网关",
      modelsEn: "All models + self-hosted private gateways",
      branching: "无限制深度分支与协同",
      branchingEn: "Unlimited branching with collaborative review",
      knowledgeStorage: "500 篇团队级知识文档",
      knowledgeStorageEn: "500 team-wide document chunks",
      ragLimit: "高并发混合语义召回",
      ragLimitEn: "High-concurrency hybrid semantic recall",
      byok: true,
      auditLog: true,
      support: "专属技术顾问优先支持",
      supportEn: "Priority technical specialist response",
    },
  },
  {
    id: "enterprise",
    name: "Enterprise 旗舰定制",
    nameEn: "Enterprise Custom",
    tagline: "满足金融、军工与大型科技企业的高合规私有化诉求",
    taglineEn: "Air-gapped and high-compliance deployments for finance and tech enterprises",
    priceMonthly: 199,
    priceAnnual: 169,
    popular: false,
    ctaText: "联系商务团队",
    ctaTextEn: "Contact Sales",
    ctaHref: "/contact",
    features: [
      "包含 Team 团队版所有功能与定制能力",
      "支持私有 VPC、专有云或 On-Premise 部署",
      "企业单点登录（SSO / SAML 2.0 / OIDC 对接）",
      "企业内部私有模型网关（vLLM, Ollama 物理私网）",
      "金融级数据加密合规与操作审计归档",
      "专属 99.99% 可用性 SLA 保证与快赔承诺",
      "专属企业技术架构师 1v1 方案定制与支持",
    ],
    featuresEn: [
      "All Team tier capabilities + enterprise customization",
      "Private VPC, dedicated cloud, or On-Premise deployment",
      "Enterprise SSO (SAML 2.0, Okta, Azure AD, OIDC)",
      "Intranet private model gateways (vLLM, Ollama air-gapped)",
      "Financial-grade data residency & audit logs",
      "Guaranteed 99.99% uptime SLA with compensation policy",
      "Dedicated Enterprise Solution Architect 1-on-1 advisory",
    ],
    specs: {
      workspaces: "无限多级部门与子空间",
      workspacesEn: "Unlimited department hierarchy & spaces",
      models: "任意私有或开源大模型集群",
      modelsEn: "Any private or open-weight model cluster",
      branching: "企业级高并发审计留痕",
      branchingEn: "Enterprise high-throughput immutable audit",
      knowledgeStorage: "无上限专属向量/全文存储",
      knowledgeStorageEn: "Unlimited vector & full-text storage",
      ragLimit: "毫秒级分布式海量知识召回",
      ragLimitEn: "Sub-millisecond distributed recall",
      byok: true,
      auditLog: true,
      support: "7x24 小时专属架构师 VIP 通道",
      supportEn: "24/7 dedicated enterprise VIP channel",
    },
  },
];
export const CORE_FEATURES: FeatureItem[] = [
  {
    id: "multi-model",
    badge: "模型聚合生态",
    badgeEn: "Model Gateway",
    title: "全球顶尖模型，一处统一调度",
    titleEn: "Frontier Models, Unified Orchestration",
    description:
      "原生打通 OpenAI、Anthropic Claude、DeepSeek、Google Gemini 与 OpenRouter。支持添加任何兼容 OpenAI 协议的私有网关或自建大模型，动态热刷新模型目录。",
    descriptionEn:
      "Native zero-latency routing across OpenAI, Claude 3.7, DeepSeek-R1, Gemini 2.0, and OpenRouter. Connect custom OpenAI-compatible private endpoints with dynamic hot-reload.",
    metrics: "支持 100+ 主流模型热插拔",
    metricsEn: "100+ frontier models hot-swappable",
    iconName: "Cpu",
  },
  {
    id: "branching",
    badge: "思维树状推理",
    badgeEn: "Thought Branching",
    title: "非覆盖式会话分支，多维思维对比",
    titleEn: "Non-Destructive Thought Branching",
    description:
      "独创的树状会话与分支重试机制。重新提问不再覆盖历史上下文，保留每一次思考分支，自由横向比对不同模型在相同 Prompt 下的推理深度。",
    descriptionEn:
      "Branch conversations without destructive overwrites. Fork any message node into alternate model comparisons, exploring side-by-side prompt revisions simultaneously.",
    metrics: "历史回溯零丢失",
    metricsEn: "Zero conversational state loss",
    iconName: "GitFork",
  },
  {
    id: "rag",
    badge: "混合知识引擎",
    badgeEn: "Hybrid RAG Engine",
    title: "企业级混合检索 RAG，来源精准审计",
    titleEn: "Enterprise Hybrid RAG with Verifiable Citations",
    description:
      "支持导入 PDF、Word、TXT、Markdown、CSV 与 JSON。Neon pg_trgm 快速召回 + 智能语义打分 + 文档多样性重排，每次回答精准标注溯源引文，拒绝胡言乱语。",
    descriptionEn:
      "Ingest PDF, DOCX, TXT, Markdown, CSV, and JSON. Trigram candidate recall combined with semantic scoring and re-ranking provides mathematically grounded citations without hallucination.",
    metrics: "200 页 / 50 万字符单篇吞吐",
    metricsEn: "200 pages / 500k chars per document",
    iconName: "Database",
  },
  {
    id: "idempotency",
    badge: "工业级可靠性",
    badgeEn: "Production Resilience",
    title: "UUID + SHA-256 幂等引擎，零重复扣费",
    titleEn: "Cryptographic Idempotency Engine, Zero Duplicate Billing",
    description:
      "全链路采用密码学级请求指纹与分布式幂等锁。在面对网络中断、客户端偶发重试或突发抖动时，绝不产生重复扣费，支持实时生成状态恢复与秒级回放。",
    descriptionEn:
      "End-to-end SHA-256 request finger-printing with distributed atomic locks. Handles unexpected network disconnects or client retries with guaranteed zero duplicate upstream charges.",
    metrics: "99.99% 生成幂等防护",
    metricsEn: "99.99% idempotent execution guarantee",
    iconName: "ShieldCheck",
  },
  {
    id: "security",
    badge: "硬件级安全防线",
    badgeEn: "Hardware Security",
    title: "AES-256-GCM 凭证加密与物理级防 SSRF",
    titleEn: "AES-256-GCM Vault & Intranet SSRF Prevention",
    description:
      "所有工作区 API Key 均采用 AES-256-GCM 工业标准加密落库，绝不出库至前端。服务端严格执行私有网络与私有 IP 探测过滤，物理级阻断内网 SSRF 渗透风险。",
    descriptionEn:
      "All credentials encrypted with AES-256-GCM authenticated cipher and never sent to clients. The backend strictly screens intranet IP addresses to prevent SSRF vulnerabilities.",
    metrics: "金融级密钥隔离标准",
    metricsEn: "Hardware-grade key vault standard",
    iconName: "Lock",
  },
  {
    id: "observability",
    badge: "运营可观测看板",
    badgeEn: "Observability Radar",
    title: "实时 Token 成本、延迟与健康度雷达",
    titleEn: "Live Token Cost, Latency & Provider Radar",
    description:
      "为企业管理者提供透明的运营决策面板。全天候监控各供应商心跳、请求成功率、P95 延迟，并统计最近 30 天 Token 输入输出用量与精准成本预估，拒绝暗箱账单。",
    descriptionEn:
      "Continuous health monitoring for upstream providers with P95 latency radar. Detailed 30-day token spend breakdowns and granular cost forecasting without hidden charges.",
    metrics: "全天候供应商健康侦测",
    metricsEn: "24/7 autonomous provider heartbeat",
    iconName: "Activity",
  },
];

export const USE_CASES: UseCaseItem[] = [
  {
    role: "研发架构师 & 全栈工程师",
    roleEn: "Principal Systems Architect",
    company: "知名基础软件实验室",
    companyEn: "Distributed Systems Research Lab",
    quote:
      "ai2dot 的分支对比功能彻底改变了我们团队评估架构设计的方式。我们可以针对同一个重构方案，同时让 Claude 3.7 和 DeepSeek-R1 给出权衡考量，历史分支丝滑保留，决策效率大幅跃升。",
    quoteEn:
      "The branching comparison in ai2dot transformed our architectural reviews. We can prompt Claude 3.7 and DeepSeek-R1 simultaneously on refactoring trade-offs while keeping every branch immutable. Decision velocity improved dramatically.",
    benefit: "研发技术方案评审效率提升 40%",
    benefitEn: "40% faster technical design consensus",
  },
  {
    role: "合规专家 & 知识资产总监",
    roleEn: "Compliance & Knowledge Director",
    company: "亚太合规与知识产权咨询机构",
    companyEn: "APAC Legal & IP Advisory",
    quote:
      "在导入数百份行业准则与合同法案后，ai2dot 的 RAG 检索不仅准确度极高，关键是回答下方带有结构化的溯源引文，让我们完全避免了模型幻觉带来的合规风险。",
    quoteEn:
      "After indexing hundreds of regulatory standards, ai2dot's hybrid RAG delivers extraordinary retrieval precision. Structured citation links under every answer eliminate compliance hallucinations.",
    benefit: "法务与合规检索准确率超过 98.6%",
    benefitEn: "98.6% verifiable citation accuracy",
  },
  {
    role: "AI 战略与基础设施负责人",
    roleEn: "Head of AI Infrastructure",
    company: "高成长跨境独角兽企业",
    companyEn: "Global Tech Unicorn",
    quote:
      "作为企业 IT 负责人，我们最看重的是密钥安全和成本控制。ai2dot 的 AES-256-GCM 本地加密和防重计费幂等机制，让公司内部推广 AI 时不仅省心而且账单透明受控。",
    quoteEn:
      "As an infrastructure lead, credential isolation and cost predictability are paramount. ai2dot's AES-256-GCM hardware vault and request idempotency ensure zero duplicate billing across our teams.",
    benefit: "月度模型 API 采购成本节省 32%",
    benefitEn: "32% monthly API procurement cost reduction",
  },
];

export const FAQS: FaqItem[] = [
  {
    question: "ai2dot 与市面上普通 AI 聊天网页有什么核心区别？",
    questionEn: "What sets ai2dot apart from standard single-model AI chat apps?",
    answer:
      "ai2dot 是专为高要求的专业人士和团队打造的聚合工作台。相比单一模型的 Web 客户端，ai2dot 具备三大杀手锏：第一，一站接入全球顶尖模型与 BYOK 自建网关；第二，具备非覆盖式树状分支推理机制，调整提示词不丢失原分支；第三，拥有工业级生成幂等引擎，遭遇网络异常零重复计费，并提供企业级知识库混合 RAG 检索与审计看板。",
    answerEn:
      "ai2dot is an enterprise-grade orchestration workspace. Unlike conventional chat wrappers, ai2dot delivers three core engineering advantages: universal multi-model BYOK routing, non-destructive thought branching that preserves exploratory context, and a cryptographic SHA-256 idempotency engine that protects against duplicate network charges.",
  },
  {
    question: "我们的 API 密钥和商业数据会被 ai2dot 窥探或用于模型训练吗？",
    questionEn: "Will our enterprise API keys and corporate data be used to train models?",
    answer:
      "绝对不会。ai2dot 秉承严格的 Privacy First 隐私优先原则。用户配置的 API Key 在服务端采用 AES-256-GCM 硬件级强加密算法存储，密钥仅在模型发起调用瞬间解密，绝不返回给浏览器，也不会持久化明文。同时，ai2dot 承诺不使用任何用户会话数据进行大模型训练。",
    answerEn:
      "Never. We uphold a strict Privacy-First architecture. All API credentials are encrypted with AES-256-GCM and decrypted only in ephemeral server memory during active inference. We never persist credentials in plain text or train models on user conversations.",
  },
  {
    question: "产品应用可以直接在浏览器中体验吗？",
    questionEn: "Can we experience the application immediately inside the browser?",
    answer:
      "是的！您只需点击页面右上角或 Hero 区域的「进入工作台」按钮，即可直达 https://ai.ai2dot.com/。未登录时默认提供开箱即用的极速演示模式；配置您自己的 Provider 后，即可解锁全量云端会话同步、知识库解析与智能体定制能力。",
    answerEn:
      "Yes! Click 'Launch Workspace' to navigate directly to https://ai.ai2dot.com/. A live demonstration workspace is available instantly without setup. Connecting your BYOK providers unlocks persistent cloud synchronization, RAG ingestion, and custom agents.",
  },
  {
    question: "ai2dot 如何保证网络断连时不发生二次扣费？",
    questionEn: "How does ai2dot prevent double billing during network interruptions?",
    answer:
      "应用后端内置了基于 SHA-256 与 UUID 的唯一请求指纹生成机制。当同一个请求由于前端重试、弱网重连或意外重传时，幂等引擎会在持久层识别指纹冲突并直接回放已完成或流式中的生成结果，物理隔离重复调用上游 API 的扣费风险。",
    answerEn:
      "Our backend computes deterministic SHA-256 idempotency fingerprints for incoming requests. When network dropped packets trigger retries, the idempotency layer detects hash collision and replays existing generation tokens without making duplicate upstream API calls.",
  },
  {
    question: "支持哪些文档格式上传到知识库？解析速度如何？",
    questionEn: "Which document formats are supported for RAG, and how fast is indexing?",
    answer:
      "当前支持 PDF、DOCX、TXT、Markdown、CSV 与 JSON 六大主流格式，单文件上限为 4MB（PDF 最多支持 200 页，文本上限 50 万字）。文档上传后由服务端在后台异步清洗分块，通常百页级文档仅需数秒即可完成索引并用于高精度召回。",
    answerEn:
      "We support PDF, DOCX, TXT, Markdown, CSV, and JSON up to 4MB (up to 200 pages or 500k characters). Documents are asynchronously chunked and indexed in seconds, immediately available for citation retrieval.",
  },
  {
    question: "我们是大型企业，需要部署在私有云或自建机房，支持吗？",
    questionEn: "Do you support on-premise, VPC, or private cloud deployment for enterprises?",
    answer:
      "完全支持！ai2dot 采用模块化 Next.js + Neon PostgreSQL 纯云原生架构，可直接打包为 Docker 容器部署于私有 Kubernetes 集群或通过 Vercel 企业版私网互联。针对 Enterprise 企业客户，我们还提供 SSO / SAML 对接与专属私网大模型适配服务，欢迎通过「联系商务」沟通定制方案。",
    answerEn:
      "Absolutely. Built with modern Next.js and Postgres, ai2dot deploys seamlessly as containerized services inside private Kubernetes clusters or air-gapped VPCs. Enterprise tiers include SAML 2.0 / Okta SSO, audit logging, and custom private LLM gateway adapters.",
  },
];
