# Gives Markdown task-list checkboxes an accessible name (#174).
#
# kramdown's GFM parser renders `- [ ] text` as
#   <li class="task-list-item"><input type="checkbox" class="task-list-item-checkbox" disabled>text</li>
# and the <input> has no name, which axe reports as `label` (critical). This hook wraps the inline
# content that follows each checkbox in a <span id> and points the checkbox's aria-labelledby at it.
# The native checked/disabled attributes are left alone, so assistive tech still announces the state.
#
# Decisions (architect review on #174), recorded so they are not undone:
# - :post_render over the composed page, not :post_convert per fragment. A task list can reach a page
#   through a layout or include (a note's content, rendered by _includes/activity.liquid on /activity/
#   and the about page), and id uniqueness can only be checked against the whole page.
# - aria-labelledby + <span>, not a <label> wrapper: Bootstrap's reboot makes <label> inline-block with
#   a bottom margin, which would change how task lists look. No class is added, so PurgeCSS has
#   nothing to strip and no stylesheet changes.
# - Build time, not client-side JS: a script would fix the page only after it loads, so readers with
#   JS off and anything reading the served HTML would still get unnamed checkboxes.
# - .html output only. jekyll-feed embeds post content in feed.xml as raw HTML inside CDATA, and
#   re-serializing that file as HTML would break the Atom feed.
# - Parsing with Nokogiri::HTML adds no new serialization behavior while `external_links.enabled` is
#   true in _config.yml (as it is today): jekyll-link-attributes then already round-trips every
#   document's and every .html page's output through it. If that is turned off, this hook becomes the
#   only HTML round-trip, on pages that contain task lists.

require 'nokogiri'
require 'set'

module Jekyll
  module TaskListLabels
    CHECKBOX = 'task-list-item-checkbox'
    ID_PREFIX = 'task-list-label-'
    # Inline content ends at the first block element; a nested sub-list stays out of the name.
    BLOCK_TAGS = %w[
      address article aside blockquote details div dl fieldset figure footer form
      h1 h2 h3 h4 h5 h6 header hr main nav ol p pre section table ul
    ].freeze

    def self.process(item)
      return unless item.output_ext == '.html'
      return unless item.output&.include?(CHECKBOX)

      doc = Nokogiri::HTML(item.output)
      boxes = doc.css("input.#{CHECKBOX}").reject do |box|
        box['aria-labelledby'] || box['aria-label']
      end
      return if boxes.empty?

      # One set for the whole pass: every id already in the page, plus each id assigned here.
      used = doc.css('[id]').map { |node| node['id'] }.to_set
      counter = 0

      boxes.each do |box|
        inline = []
        node = box.next_sibling
        while node && !(node.element? && BLOCK_TAGS.include?(node.name))
          inline << node
          node = node.next_sibling
        end

        # An item with no text (and no emoji image, whose alt text names it) still gets a name.
        if inline.none? { |n| named?(n) }
          box['aria-label'] = 'Task list item'
          next
        end

        id = nil
        loop do
          counter += 1
          id = "#{ID_PREFIX}#{counter}"
          break unless used.include?(id)
        end
        used << id

        span = Nokogiri::XML::Node.new('span', doc)
        span['id'] = id
        box.add_next_sibling(span)
        inline.each { |n| span.add_child(n) }
        box['aria-labelledby'] = id
      end

      item.output = doc.to_s
    end

    # Content that never contributes to an accessible name: comments are not elements or text, and
    # these elements' text is not rendered.
    NAMELESS_TAGS = %w[script style template].freeze
    VISIBLE_TEXT = './/text()[not(ancestor::script or ancestor::style or ancestor::template)]'

    def self.named?(node)
      return !node.text.strip.empty? if node.text?
      return false unless node.element?
      return false if NAMELESS_TAGS.include?(node.name)
      return !node['alt'].to_s.strip.empty? if node.name == 'img'

      node.xpath(VISIBLE_TEXT).any? { |t| !t.text.strip.empty? } ||
        node.css('img[alt]').any? { |img| !img['alt'].strip.empty? }
    end
  end
end

Jekyll::Hooks.register [:pages, :documents], :post_render do |item|
  Jekyll::TaskListLabels.process(item)
end
