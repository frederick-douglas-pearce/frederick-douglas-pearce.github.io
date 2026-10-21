# Local plugin, not from upstream al-folio.
#
# _pages/blog.md only renders a chip for a display_categories entry whose exact
# name some post carries (so a series can be listed before its first post syncs).
# The cost of that filter is that a near-miss -- "Claude-Code-Loop" or a stray
# slug difference against the posts' "claude-code-loop" -- hides the chip forever
# with no error. Before the filter the chip still rendered, its href slugified to
# a working archive, so such a mismatch used to work. Fail the build instead.
#
# A listed entry that matches no post at all is deliberately allowed: that is a
# series listed ahead of its first post. Posts whose category is not listed are
# not checked here either (issue #107).
#
# Runs at :pre_render, after generators (external-posts.rb can add posts), and
# reads the posts directly instead of site.categories, whose memoized hash has a
# default proc that would record any key looked up in it.
Jekyll::Hooks.register :site, :pre_render do |site|
  listed = Array(site.config['display_categories'])
  used = site.posts.docs.flat_map { |doc| Array(doc.data['categories']) }.uniq

  listed.each do |entry|
    next if used.include?(entry)

    near = used.select { |name| Jekyll::Utils.slugify(name) == Jekyll::Utils.slugify(entry) }
    next if near.empty?

    raise Jekyll::Errors::FatalException,
          "display_categories lists #{entry.inspect}, but posts use #{near.map(&:inspect).join(', ')}. " \
          "The blog chip matches names exactly, so it would never render. Make the two spellings agree."
  end
end
