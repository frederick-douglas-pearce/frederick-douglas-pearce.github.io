# Claude.md - Project Guide

Personal portfolio website for Frederick Douglas Pearce (Earth scientist turned data scientist), built with Jekyll and the al-folio template, hosted on GitHub Pages.

## Tech Stack

- **Static Site Generator:** Jekyll 4.x with kramdown
- **CSS Framework:** Bootstrap 4, Material Design Bootstrap, SCSS
- **JavaScript:** Vanilla JS, Bootstrap JS
- **Hosting:** GitHub Pages
- **Data Formats:** YAML, JSON, BibTeX, Markdown

## Directory Structure

```
_bibliography/     # BibTeX publications (papers.bib)
_books/            # Book reviews collection
_data/             # YAML/JSON data files (cv.yml, esg_news.json, socials.yml)
_includes/         # Liquid template partials
_layouts/          # Page layout templates
_news/             # News/announcement items
_pages/            # Static pages (about.md, cv.md, projects.md, etc.)
_plugins/          # Custom Ruby plugins
_posts/            # Blog posts (YYYY-MM-DD-title.md format)
_projects/         # Portfolio project pages
_sass/             # SCSS stylesheets
assets/
  ├── css/         # Compiled CSS
  ├── img/         # Images (prof_pic.jpg, screenshots)
  ├── js/          # JavaScript files
  └── json/        # JSON data (resume.json)
```

## Key Configuration Files

- **\_config.yml** - Main Jekyll config (site settings, plugins, third-party libs)
- **Gemfile** - Ruby gem dependencies
- **package.json** - Node.js dependencies

## Content Types

| Type         | Location                   | Format                         |
| ------------ | -------------------------- | ------------------------------ |
| Blog posts   | `_posts/`                  | `YYYY-MM-DD-title.md`          |
| Projects     | `_projects/`               | Markdown with YAML frontmatter |
| Publications | `_bibliography/papers.bib` | BibTeX                         |
| Pages        | `_pages/`                  | Markdown                       |
| News         | `_news/`                   | Markdown                       |

## Custom Features

### ESG News Classifier System

A custom addition for displaying ESG-classified news articles:

- **Data:** `_data/esg_news.json` - Large JSON with classified articles
- **Page:** `_pages/esg-news.md` - News feed with filters
- **JS:** `assets/js/esg_news_filter.js` - Client-side filtering
- **Styles:** `_sass/_esg_news.scss` - Feed styling
- **Project page:** `_projects/esg_classifier.md`

### Key Plugins (`_plugins/`)

- `google-scholar-citations.rb` - Fetch citation counts
- `download-3rd-party.rb` - Cache CDN libraries locally
- `cache-bust.rb` - Static asset cache busting

## Pre-Push Requirements

**Always run Prettier before pushing:**

```bash
npx prettier . --check    # Check formatting
npx prettier . --write    # Fix formatting issues
```

The GitHub Actions workflow enforces Prettier formatting. Pushes with formatting issues will fail CI.

## Common Tasks

### Local Development

```bash
bundle install          # Install Ruby dependencies
bundle exec jekyll serve --livereload  # Start dev server (localhost:4000)
```

### Adding Content

- **New blog post:** Create `_posts/YYYY-MM-DD-title.md` with frontmatter
- **New project:** Create `_projects/project-name.md` with frontmatter
- **New publication:** Add entry to `_bibliography/papers.bib`

### Build for Production

```bash
JEKYLL_ENV=production bundle exec jekyll build
```

## Frontmatter Examples

### Blog Post

```yaml
---
layout: post
title: Post Title
date: YYYY-MM-DD HH:MM:SS
description: Brief description
tags: [tag1, tag2]
categories: category-name
---
```

### Project

```yaml
---
layout: page
title: Project Title
description: Project description
img: assets/img/project-image.jpg
importance: 1
category: work
---
```

## Styling

- Main SCSS entry: `assets/css/main.scss`
- Variables: `_sass/_variables.scss`
- Themes (light/dark): `_sass/_themes.scss`
- Base styles: `_sass/_base.scss`
- Custom styles should go in appropriate `_sass/_*.scss` files

## Important Considerations

1. **Image Processing:** ImageMagick generates responsive WebP images at 480/800/1400px widths
2. **Dark Mode:** Site supports dark mode - test changes in both themes
3. **Third-party Libraries:** CDN libraries are configured in `_config.yml` with integrity hashes
4. **Jekyll Scholar:** Publications use APA citation style with citation badges (Altmetric, Dimensions, Google Scholar)
5. **Search:** Full-text search indexes posts and publications
6. **Comments:** Giscus (GitHub Discussions) integration enabled

## File Naming Conventions

- Posts: `YYYY-MM-DD-kebab-case-title.md`
- Projects: `kebab-case-name.md`
- SCSS partials: `_partial-name.scss`
- JS modules: `kebab-case-name.js`

## Do Not Modify

- `_site/` - Generated output (gitignored)
- `.jekyll-cache/` - Build cache
- Files in `bin/` - Build scripts from al-folio template
