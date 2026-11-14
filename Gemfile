source 'https://rubygems.org'

gem 'jekyll'

# Security updates - minimum versions to address vulnerabilities
gem 'nokogiri', '>= 1.19.5'    # CVE patches for libxml2; >=1.19.5 fixes use-after-free, HTML5 serializer mXSS and NodeSet OOB read (GHSA-5prr-v3j2-97mh, GHSA-4p39-36wj-23h4, GHSA-3w22-6jfg-527w); >=1.19.3 fixed ReDoS + XSLT leak (GHSA-c4rq-3m3g-8wgx, GHSA-v2fc-qm4h-8hqv)
gem 'rexml', '>= 3.4.2'        # DoS vulnerability fix
gem 'uri', '>= 1.0.4'          # Credential leakage fix
gem 'activesupport', '>= 8.1.4.1' # >=8.1.4.1 fixes safe_constantize DoS and MessagePack serializer XSS (GHSA-8474-xrp6-wh69, GHSA-2w9f-fxwj-w2qf); >=8.0.4.1 fixed earlier DoS, XSS, and ReDoS

# Core plugins that directly affect site building
group :jekyll_plugins do
    gem 'jekyll-archives-v2'
    gem 'jekyll-email-protect'
    gem 'jekyll-feed'
    gem 'jekyll-get-json'
    gem 'jekyll-imagemagick'
    gem 'jekyll-jupyter-notebook'
    gem 'jekyll-link-attributes'
    gem 'jekyll-minifier'
    gem 'jekyll-paginate-v2'
    gem 'jekyll-regex-replace'
    gem 'jekyll-scholar'
    gem 'jekyll-sitemap'
    gem 'jekyll-tabs'
    gem 'jekyll-terser', :git => "https://github.com/RobertoJBeltran/jekyll-terser.git"
    gem 'jekyll-toc'
    gem 'jekyll-twitter-plugin'
    gem 'jemoji'

    gem 'classifier-reborn'  # used for content categorization during the build
end

# Gems for development or external data fetching (outside :jekyll_plugins)
group :other_plugins do
    # css_parser: used only by _plugins/download-3rd-party.rb (third_party_libraries.download). 3.x hardens
    # read_remote_file against SSRF (GHSA-9pmc-p236-855h) and 3.3 fixes a local-file read via @import. The
    # plugin's calls (Parser.new, load_string!, each_rule_set, RuleSet#[] / #[]=, to_s) are unchanged from 1.x,
    # checked by running the plugin's own function under both (#132). No build calls the parser while download
    # is false, so a major bump needs that check repeated; 3.x requires Ruby >= 3.3 (CI pins 3.3).
    gem 'css_parser', '~> 3.4'
    gem 'feedjira'
    gem 'httparty', '>= 0.24.0'  # SSRF vulnerability fix
    gem 'observer'       # used by jekyll-scholar
    gem 'ostruct'        # used by jekyll-twitter-plugin
    # gem 'terser'         # used by jekyll-terser
    # gem 'unicode_utils' -- should be already installed by jekyll
    # gem 'webrick' -- should be already installed by jekyll
end
