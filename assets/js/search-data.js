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
          description: "",
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
        id: 'social-scholar',
        title: 'Google Scholar',
        section: 'Socials',
        handler: () => {
          window.open("https://scholar.google.com/citations?user=8sKkGHQAAAAJ", "_blank");
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
