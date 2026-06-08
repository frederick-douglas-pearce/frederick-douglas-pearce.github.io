// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [{
    id: "nav-about",
    title: "about",
    section: "Navigation",
    handler: () => {
      window.location.href = "/";
    },
  },{id: "nav-blog",
          title: "blog",
          description: "Fred&#39;s Data blog - insights and lessons learned on the journey from Earth science to data science.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/blog/";
          },
        },{id: "nav-projects",
          title: "projects",
          description: "Machine learning and data science projects showcasing end-to-end solutions.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/projects/";
          },
        },{id: "nav-cv",
          title: "cv",
          description: "This page contains a detailed summary of my professional experience. My resume can be downloaded using the pdf link above.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/cv/";
          },
        },{id: "nav-publications",
          title: "publications",
          description: "Here is a list of the publications I&#39;ve authored in reverse chronological order.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/publications/";
          },
        },{id: "post-how-often-does-claude-retry-a-tool-call",
        
          title: "How often does Claude retry a tool call?",
        
        description: "The session JSONL&#39;s tool_use_id pairing key (introduced in Part 2) lets you measure how often Claude retries after a tool error — and the answer is different by tool, which is where it gets interesting.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2026/how-often-does-claude-retry-a-tool-call/";
          
        },
      },{id: "post-reading-a-claude-code-session-line-by-line",
        
          title: "Reading a Claude Code session, line by line",
        
        description: "Part 2 of the anatomy series. Every type of line in a session JSONL, the snake_case/camelCase split that reveals two layers (API content wrapped in Claude Code&#39;s bookkeeping), and why tool results live inside user messages.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2026/reading-a-claude-code-session-line-by-line/";
          
        },
      },{id: "post-anatomy-of-a-claude-code-session",
        
          title: "Anatomy of a Claude Code session",
        
        description: "Every Claude Code session writes a detailed local JSONL record of your prompts, tool calls, and token usage — here&#39;s what&#39;s in it and what it powers.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2026/anatomy-of-a-claude-code-session/";
          
        },
      },{id: "projects-codefluent",
          title: 'CodeFluent',
          description: "Personal AI fluency analytics for Claude Code users",
          section: "Projects",handler: () => {
              window.location.href = "/projects/codefluent/";
            },},{id: "projects-sportswear-esg-news-classifier",
          title: 'Sportswear ESG News Classifier',
          description: "Multi-label text classification for sportswear brand ESG news",
          section: "Projects",handler: () => {
              window.location.href = "/projects/esg_classifier/";
            },},{id: "projects-e-commerce-fraud-detection",
          title: 'E-Commerce Fraud Detection',
          description: "Real-time fraud detection with XGBoost and SHAP explainability",
          section: "Projects",handler: () => {
              window.location.href = "/projects/fraud_detection/";
            },},{
        id: 'social-email',
        title: 'email',
        section: 'Socials',
        handler: () => {
          window.open("mailto:%66%72%65%64%65%72%69%63%6B.%64%6F%75%67%6C%61%73.%70%65%61%72%63%65@%67%6D%61%69%6C.%63%6F%6D", "_blank");
        },
      },{
        id: 'social-github',
        title: 'GitHub',
        section: 'Socials',
        handler: () => {
          window.open("https://github.com/frederick-douglas-pearce", "_blank");
        },
      },{
        id: 'social-linkedin',
        title: 'LinkedIn',
        section: 'Socials',
        handler: () => {
          window.open("https://www.linkedin.com/in/frederick-douglas-pearce", "_blank");
        },
      },{
        id: 'social-orcid',
        title: 'ORCID',
        section: 'Socials',
        handler: () => {
          window.open("https://orcid.org/0009-0003-6756-6463", "_blank");
        },
      },{
      id: 'light-theme',
      title: 'Change theme to light',
      description: 'Change the theme of the site to Light',
      section: 'Theme',
      handler: () => {
        setThemeSetting("light");
      },
    },
    {
      id: 'dark-theme',
      title: 'Change theme to dark',
      description: 'Change the theme of the site to Dark',
      section: 'Theme',
      handler: () => {
        setThemeSetting("dark");
      },
    },
    {
      id: 'system-theme',
      title: 'Use system default theme',
      description: 'Change the theme of the site to System Default',
      section: 'Theme',
      handler: () => {
        setThemeSetting("system");
      },
    },];
