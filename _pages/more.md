---
# Nav-only page: this file exists solely to declare the `more` dropdown in the
# navbar (_includes/header.liquid). It renders nothing -- `layout: none` with an
# empty body -- and stays out of the sitemap. The children below are declared by
# literal permalink, so the child pages carry no `nav:` of their own.
layout: none
title: more
nav: true
# Slot 4 is deliberately left free for the planned consulting tab (#76); `more`
# stays last in the navbar.
nav_order: 5
sitemap: false
dropdown: true
children:
  - title: publications
    permalink: /publications/
  - title: repositories
    permalink: /repositories/
  - title: activity
    permalink: /activity/
---
