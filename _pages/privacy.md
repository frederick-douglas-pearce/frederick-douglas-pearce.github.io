---
layout: page
title: privacy
permalink: /privacy/
description: What this site measures, why it needs no cookie banner, and how to opt out.
nav: false
---

This is a personal site. It runs no advertising, sells nothing, and has no account
system, so there is nothing here that needs to know who you are. The only data
collected is aggregate traffic measurement, described in full below.

## Analytics

Traffic is measured with [Umami](https://umami.is/), a privacy-focused analytics
service, hosted on Umami Cloud. It is **cookieless** — it stores nothing on your
device, sets no identifier that follows you across sites, and for that reason this
site shows no cookie-consent banner.

For each pageview, Umami records:

- the page you viewed and the page you arrived from (the referrer, including any
  campaign tags on the link)
- your country, derived from your IP address
- your device type, browser, and operating system

Visits are grouped into sessions by a hash of your IP address, user agent, and this
site's ID. Your IP address itself is not stored, and the hash is meaningless outside
this one site — it cannot be used to recognize you elsewhere or to work backwards to
you. No personal data is collected, and none of it is sold, shared, or joined with
anything else. Umami Cloud's free tier keeps six months of history, after which the
data ages out.

If you would rather not be counted, an ad blocker or privacy extension that blocks
`cloud.umami.is` will do it, and nothing on this site breaks when the script fails
to load.

## Search engines

Search performance — which queries surface this site and how often — comes from
Google Search Console and Bing Webmaster Tools. Those services report on pages
already in their own public index; they receive nothing from this site beyond a
verification tag proving I own the domain.

## Hosting

The site is served by [GitHub Pages](https://pages.github.com/). Like any web host,
GitHub processes request data, including IP addresses, in the course of serving
pages. That is outside my control and is covered by
[GitHub's privacy statement](https://docs.github.com/site-policy/privacy-policies/github-privacy-statement).

## Contact

Questions about any of this, or a request to have something removed, can be sent to
me by [email](mailto:{{ site.data.socials.email | encode_email }}).
