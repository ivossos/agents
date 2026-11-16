window.AGENTS=[
 {
  "id": "joker",
  "dept": "bonus",
  "desc": "Use this agent when you need to lighten the mood, create funny content, or add humor to any situation. This agent specializes in dad jokes, programming puns, and startup humor.",
  "color": "yellow",
  "tools": [
   "Write"
  ]
 },
 {
  "id": "studio-coach",
  "dept": "bonus",
  "desc": "PROACTIVELY use this agent when complex multi-agent tasks begin, when agents seem stuck or overwhelmed, or when the team needs motivation and coordination. This agent serves as the elite performance coach for all other agents, ensuring they operate at their highest level while maintaining composure and excellence. Should be triggered automatically at the start of challenging projects or when detecting agent confusion.",
  "color": "gold",
  "tools": [
   "Task",
   "Write",
   "Read"
  ]
 },
 {
  "id": "brand-guardian",
  "dept": "design",
  "desc": "Use this agent when establishing brand guidelines, ensuring visual consistency, managing brand assets, or evolving brand identity. This agent specializes in creating and maintaining cohesive brand experiences across all touchpoints while enabling rapid development.",
  "color": "indigo",
  "tools": [
   "Write",
   "Read",
   "MultiEdit",
   "WebSearch",
   "WebFetch"
  ]
 },
 {
  "id": "ui-designer",
  "dept": "design",
  "desc": "Use this agent when creating user interfaces, designing components, building design systems, or improving visual aesthetics. This agent specializes in creating beautiful, functional interfaces that can be implemented quickly within 6-day sprints.",
  "color": "magenta",
  "tools": [
   "Write",
   "Read",
   "MultiEdit",
   "WebSearch",
   "WebFetch"
  ]
 },
 {
  "id": "ux-researcher",
  "dept": "design",
  "desc": "Use this agent when conducting user research, analyzing user behavior, creating journey maps, or validating design decisions through testing. This agent specializes in understanding user needs, pain points, and behaviors to inform product decisions within rapid development cycles.",
  "color": "purple",
  "tools": [
   "Write",
   "Read",
   "MultiEdit",
   "WebSearch",
   "WebFetch"
  ]
 },
 {
  "id": "visual-storyteller",
  "dept": "design",
  "desc": "Use this agent when creating visual narratives, designing infographics, building presentations, or communicating complex ideas through imagery. This agent specializes in transforming data and concepts into compelling visual stories that engage users and stakeholders.",
  "color": "cyan",
  "tools": [
   "Write",
   "Read",
   "MultiEdit",
   "WebSearch",
   "WebFetch"
  ]
 },
 {
  "id": "whimsy-injector",
  "dept": "design",
  "desc": "PROACTIVELY use this agent after any UI/UX changes to ensure delightful, playful elements are incorporated. This agent specializes in adding joy, surprise, and memorable moments to user experiences. The agent should be triggered automatically when design or interface updates are made.",
  "color": "yellow",
  "tools": [
   "Read",
   "Write",
   "MultiEdit",
   "Grep",
   "Glob"
  ]
 },
 {
  "id": "ai-engineer",
  "dept": "engineering",
  "desc": "Use this agent when implementing AI/ML features, integrating language models, building recommendation systems, or adding intelligent automation to applications. This agent specializes in practical AI implementation for rapid deployment.",
  "color": "cyan",
  "tools": [
   "Write",
   "Read",
   "MultiEdit",
   "Bash",
   "WebFetch"
  ]
 },
 {
  "id": "backend-architect",
  "dept": "engineering",
  "desc": "Use this agent when designing APIs, building server-side logic, implementing databases, or architecting scalable backend systems. This agent specializes in creating robust, secure, and performant backend services.",
  "color": "purple",
  "tools": [
   "Write",
   "Read",
   "MultiEdit",
   "Bash",
   "Grep"
  ]
 },
 {
  "id": "devops-automator",
  "dept": "engineering",
  "desc": "Use this agent when setting up CI/CD pipelines, configuring cloud infrastructure, implementing monitoring systems, or automating deployment processes. This agent specializes in making deployment and operations seamless for rapid development cycles.",
  "color": "orange",
  "tools": [
   "Write",
   "Read",
   "MultiEdit",
   "Bash",
   "Grep"
  ]
 },
 {
  "id": "frontend-developer",
  "dept": "engineering",
  "desc": "Use this agent when building user interfaces, implementing React/Vue/Angular components, handling state management, or optimizing frontend performance. This agent excels at creating responsive, accessible, and performant web applications.",
  "color": "blue",
  "tools": [
   "Write",
   "Read",
   "MultiEdit",
   "Bash",
   "Grep",
   "Glob"
  ]
 },
 {
  "id": "mobile-app-builder",
  "dept": "engineering",
  "desc": "Use this agent when developing native iOS or Android applications, implementing React Native features, or optimizing mobile performance. This agent specializes in creating smooth, native-feeling mobile experiences.",
  "color": "green",
  "tools": [
   "Write",
   "Read",
   "MultiEdit",
   "Bash",
   "Grep"
  ]
 },
 {
  "id": "rapid-prototyper",
  "dept": "engineering",
  "desc": "Use this agent when you need to quickly create a new application prototype, MVP, or proof-of-concept within the 6-day development cycle. This agent specializes in scaffolding projects, integrating trending features, and building functional demos rapidly.",
  "color": "green",
  "tools": [
   "Write",
   "MultiEdit",
   "Bash",
   "Read",
   "Glob",
   "Task"
  ]
 },
 {
  "id": "test-writer-fixer",
  "dept": "engineering",
  "desc": "Use this agent when code changes have been made and you need to write new tests, run existing tests, analyze failures, and fix them while maintaining test integrity. This agent should be triggered proactively after code modifications to ensure comprehensive test coverage and suite health.",
  "color": "cyan",
  "tools": []
 },
 {
  "id": "app-store-optimizer",
  "dept": "marketing",
  "desc": "Use this agent when preparing app store listings, researching keywords, optimizing app metadata, improving conversion rates, or analyzing app store performance. This agent specializes in maximizing organic app store visibility and downloads.",
  "color": "teal",
  "tools": [
   "Write",
   "Read",
   "WebSearch",
   "WebFetch",
   "MultiEdit"
  ]
 },
 {
  "id": "tiktok-strategist",
  "dept": "marketing",
  "desc": "Use this agent when you need to create TikTok marketing strategies, develop viral content ideas, plan TikTok campaigns, or optimize for TikTok's algorithm. This agent specializes in creating shareable moments and leveraging TikTok trends for app growth.",
  "color": "pink",
  "tools": [
   "Write",
   "Read",
   "WebSearch",
   "WebFetch"
  ]
 },
 {
  "id": "feedback-synthesizer",
  "dept": "product",
  "desc": "Use this agent when you need to analyze user feedback from multiple sources, identify patterns in user complaints or requests, synthesize insights from reviews, or prioritize feature development based on user input. This agent excels at turning raw feedback into actionable product insights.",
  "color": "orange",
  "tools": [
   "Read",
   "Write",
   "Grep",
   "WebFetch",
   "MultiEdit"
  ]
 },
 {
  "id": "sprint-prioritizer",
  "dept": "product",
  "desc": "Use this agent when planning 6-day development cycles, prioritizing features, managing product roadmaps, or making trade-off decisions. This agent specializes in maximizing value delivery within tight timelines.",
  "color": "indigo",
  "tools": [
   "Write",
   "Read",
   "TodoWrite",
   "Grep"
  ]
 },
 {
  "id": "trend-researcher",
  "dept": "product",
  "desc": "Use this agent when you need to identify market opportunities, analyze trending topics, research viral content, or understand emerging user behaviors. This agent specializes in finding product opportunities from TikTok trends, App Store patterns, and social media virality.",
  "color": "purple",
  "tools": [
   "WebSearch",
   "WebFetch",
   "Read",
   "Write",
   "Grep"
  ]
 },
 {
  "id": "experiment-tracker",
  "dept": "project-management",
  "desc": "PROACTIVELY use this agent when experiments are started, modified, or when results need analysis. This agent specializes in tracking A/B tests, feature experiments, and iterative improvements within the 6-day development cycle. Should be triggered automatically when experimental code paths or feature flags are introduced.",
  "color": "blue",
  "tools": [
   "Read",
   "Write",
   "MultiEdit",
   "Grep",
   "Glob",
   "TodoWrite"
  ]
 },
 {
  "id": "project-shipper",
  "dept": "project-management",
  "desc": "PROACTIVELY use this agent when approaching launch milestones, release deadlines, or go-to-market activities. This agent specializes in coordinating launches, managing release processes, and executing go-to-market strategies within the 6-day development cycle. Should be triggered automatically when release dates are set, launch plans are needed, or market positioning is discussed.",
  "color": "purple",
  "tools": [
   "Read",
   "Write",
   "MultiEdit",
   "Grep",
   "Glob",
   "TodoWrite",
   "WebSearch"
  ]
 },
 {
  "id": "studio-producer",
  "dept": "project-management",
  "desc": "PROACTIVELY use this agent when coordinating across multiple teams, allocating resources, or optimizing studio workflows. This agent specializes in cross-functional coordination, resource management, and process optimization within the 6-day development cycle. Should be triggered automatically when team dependencies arise, resource conflicts occur, or workflow improvements are needed.",
  "color": "green",
  "tools": [
   "Read",
   "Write",
   "MultiEdit",
   "Grep",
   "Glob",
   "TodoWrite"
  ]
 },
 {
  "id": "analytics-reporter",
  "dept": "studio-operations",
  "desc": "Use this agent when analyzing metrics, generating insights from data, creating performance reports, or making data-driven recommendations. This agent excels at transforming raw analytics into actionable intelligence that drives studio growth and optimization.",
  "color": "blue",
  "tools": [
   "Write",
   "Read",
   "MultiEdit",
   "WebSearch",
   "Grep"
  ]
 },
 {
  "id": "finance-tracker",
  "dept": "studio-operations",
  "desc": "Use this agent when managing budgets, optimizing costs, forecasting revenue, or analyzing financial performance. This agent excels at transforming financial chaos into strategic clarity, ensuring studio resources generate maximum return.",
  "color": "orange",
  "tools": [
   "Write",
   "Read",
   "MultiEdit",
   "WebSearch",
   "Grep"
  ]
 },
 {
  "id": "infrastructure-maintainer",
  "dept": "studio-operations",
  "desc": "Use this agent when monitoring system health, optimizing performance, managing scaling, or ensuring infrastructure reliability. This agent excels at keeping studio applications running smoothly while preparing for growth and preventing disasters.",
  "color": "purple",
  "tools": [
   "Write",
   "Read",
   "MultiEdit",
   "WebSearch",
   "Grep",
   "Bash"
  ]
 },
 {
  "id": "legal-compliance-checker",
  "dept": "studio-operations",
  "desc": "Use this agent when reviewing terms of service, privacy policies, ensuring regulatory compliance, or handling legal requirements. This agent excels at navigating the complex legal landscape of app development while maintaining user trust and avoiding costly violations.",
  "color": "red",
  "tools": [
   "Write",
   "Read",
   "MultiEdit",
   "WebSearch",
   "Grep"
  ]
 },
 {
  "id": "support-responder",
  "dept": "studio-operations",
  "desc": "Use this agent when handling customer support inquiries, creating support documentation, setting up automated responses, or analyzing support patterns. This agent excels at maintaining high-quality support across all studio projects while identifying product improvement opportunities.",
  "color": "green",
  "tools": [
   "Write",
   "Read",
   "MultiEdit",
   "WebSearch",
   "Grep"
  ]
 },
 {
  "id": "api-tester",
  "dept": "testing",
  "desc": "Use this agent for comprehensive API testing including performance testing, load testing, and contract testing. This agent specializes in ensuring APIs are robust, performant, and meet specifications before deployment.",
  "color": "orange",
  "tools": [
   "Bash",
   "Read",
   "Write",
   "Grep",
   "WebFetch",
   "MultiEdit"
  ]
 },
 {
  "id": "performance-benchmarker",
  "dept": "testing",
  "desc": "Use this agent for comprehensive performance testing, profiling, and optimization recommendations. This agent specializes in measuring speed, identifying bottlenecks, and providing actionable optimization strategies for applications.",
  "color": "red",
  "tools": [
   "Bash",
   "Read",
   "Write",
   "Grep",
   "MultiEdit",
   "WebFetch"
  ]
 },
 {
  "id": "test-results-analyzer",
  "dept": "testing",
  "desc": "Use this agent for analyzing test results, synthesizing test data, identifying trends, and generating quality metrics reports. This agent specializes in turning raw test data into actionable insights that drive quality improvements.",
  "color": "yellow",
  "tools": [
   "Read",
   "Write",
   "Grep",
   "Bash",
   "MultiEdit",
   "TodoWrite"
  ]
 },
 {
  "id": "tool-evaluator",
  "dept": "testing",
  "desc": "Use this agent when evaluating new development tools, frameworks, or services for the studio. This agent specializes in rapid tool assessment, comparative analysis, and making recommendations that align with the 6-day development cycle philosophy.",
  "color": "purple",
  "tools": [
   "WebSearch",
   "WebFetch",
   "Write",
   "Read",
   "Bash"
  ]
 },
 {
  "id": "workflow-optimizer",
  "dept": "testing",
  "desc": "Use this agent for optimizing human-agent collaboration workflows and analyzing workflow efficiency. This agent specializes in identifying bottlenecks, streamlining processes, and ensuring smooth handoffs between human creativity and AI assistance.",
  "color": "teal",
  "tools": [
   "Read",
   "Write",
   "Bash",
   "TodoWrite",
   "MultiEdit",
   "Grep"
  ]
 }
];
