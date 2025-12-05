# Adding Blog and Curator Voices Pages to CinemataCMS

## Overview
This guide explains how to add "Blog" and "Curator Voices" pages to your CinemataCMS installation with support for nested URLs (e.g., `/blog/my-post-title` and `/voices/curator-article`). These pages will be fully editable through the Django Admin interface using TinyMCE.

## Features Added
- **Blog section**: Main blog page with individual blog posts
- **Curator Voices section**: Curator landing page with individual curator articles  
- **Nested URL support**: URLs like `/blog/post-title` and `/voices/article-title`
- **TinyMCE editing**: All content editable through Django Admin
- **Sidebar integration**: New links appear in the main navigation

## Prerequisites
- CinemataCMS installation with admin access
- Basic understanding of Django administration
- Text editor access to configuration files

---

## Step 1: Enable Nested URL Support

**File:** `files/urls.py`

Find this line (typically near the bottom of the urlpatterns):
```python
re_path("^(?P<slug>[\w.-]*)$", views.view_page, name="get_page"),
```

Replace it with:
```python
re_path("^(?P<slug>[\w.-]+(?:/[\w.-]+)*)$", views.view_page, name="get_page"),
```

This change enables URLs with forward slashes like `/blog/post-title`.

## Step 2: Add Sidebar Navigation

**File:** `templates/config/installation/contents.html`

Find the `mainMenuExtraItems` section and modify it to include the new pages:

**Before:**
```javascript
mainMenuExtraItems: [{
    text: "Playlists",
    link: "/user/admin/playlists",
    icon: 'playlist_play',
}],
```

**After:**
```javascript
mainMenuExtraItems: [{
    text: "Playlists",
    link: "/user/admin/playlists",
    icon: 'playlist_play',
}, {
    text: "Blog",
    link: "/blog",
    icon: 'article',
}, {
    text: "Curator Voices",
    link: "/voices",
    icon: 'record_voice_over',
}],
```

## Step 3: Restart Application

Restart your CinemataCMS application to apply the changes:

```bash
# For systemd services:
sudo systemctl restart your-service-name

# For uWSGI:
pkill -HUP -f "uwsgi"

# For development server:
python manage.py runserver
```

## Step 4: Create Main Pages in Django Admin

### Access Django Admin
1. Navigate to your site's admin panel: `https://your-site.com/admin/`
2. Log in with administrator credentials
3. Go to **Files > Pages**

### Create Main Blog Page

Click **"Add Page"** and fill in:

- **Slug:** `blog`
- **Title:** `Blog`
- **Description:** (Use the TinyMCE editor)

**Sample Blog Content:**
```html
<h1>Blog</h1>

<p>Welcome to our blog, where we share insights, stories, and updates from the world of independent media and social impact storytelling.</p>

<h2>Latest Posts</h2>

<div class="blog-post">
    <h3><a href="/blog/platform-updates">Platform Updates and New Features</a></h3>
    <p><em>Posted on January 15, 2025</em></p>
    <p>Learn about the latest improvements to our video platform and upcoming features designed to better serve our community.</p>
    <p><a href="/blog/platform-updates">Read more</a></p>
</div>

<div class="blog-post">
    <h3><a href="/blog/community-spotlight">Community Spotlight: Grassroots Filmmakers</a></h3>
    <p><em>Posted on January 10, 2025</em></p>
    <p>Highlighting the amazing work being done by independent filmmakers in our community.</p>
    <p><a href="/blog/community-spotlight">Read more</a></p>
</div>

<h2>Categories</h2>
<ul>
    <li><a href="/blog/category/platform-updates">Platform Updates</a></li>
    <li><a href="/blog/category/community-stories">Community Stories</a></li>
    <li><a href="/blog/category/tutorials">Tutorials</a></li>
    <li><a href="/blog/category/announcements">Announcements</a></li>
</ul>
```

### Create Main Curator Voices Page

Click **"Add Page"** again and fill in:

- **Slug:** `voices`
- **Title:** `Curator Voices`
- **Description:** (Use the TinyMCE editor)

**Sample Curator Voices Content:**
```html
<h1>Curator Voices</h1>

<p>Hear from our community of curators, activists, and storytellers who help shape the content and direction of our platform.</p>

<h2>Latest Curator Voices</h2>

<div class="curator-voice">
    <h3><a href="/voices/independent-media-impact">The Impact of Independent Media</a></h3>
    <p><em>By Sarah Chen - January 12, 2025</em></p>
    <p>Exploring how independent media platforms are changing the landscape of digital storytelling and community engagement.</p>
    <p><a href="/voices/independent-media-impact">Read more</a></p>
</div>

<div class="curator-voice">
    <h3><a href="/voices/curator-best-practices">Best Practices for Content Curation</a></h3>
    <p><em>By Alex Rodriguez - January 8, 2025</em></p>
    <p>Insights from experienced curators on building meaningful collections and engaging with content creators.</p>
    <p><a href="/voices/curator-best-practices">Read more</a></p>
</div>

<h2>Featured Curators</h2>

<div class="curator-profile">
    <h3>Sarah Chen - Community Curator</h3>
    <p><em>Focus: Social Impact Documentation</em></p>
    <p>"Curating content is about creating connections between stories and the communities that need to hear them."</p>
</div>

<div class="curator-profile">
    <h3>Alex Rodriguez - Media Literacy Advocate</h3>
    <p><em>Focus: Educational Content</em></p>
    <p>"Every piece of media has the potential to educate and inspire. My role is to help that potential reach the right audience."</p>
</div>

<h2>Become a Curator</h2>

<p>Interested in becoming a curator? We're looking for passionate individuals who can help identify and promote important content.</p>

<p><strong>What curators do:</strong></p>
<ul>
    <li>Review and recommend submitted content</li>
    <li>Create thematic collections</li>
    <li>Write editorial content</li>
    <li>Engage with the community</li>
</ul>

<p><a href="/contact">Contact us</a> to learn more about becoming a curator.</p>
```

## Step 5: Create Individual Articles

### Blog Post Example

Create a new page with:
- **Slug:** `blog/platform-updates`
- **Title:** `Platform Updates and New Features`
- **Description:**

```html
<h1>Platform Updates and New Features</h1>

<div class="post-meta">
    <p><em>Published on January 15, 2025 | By Platform Team</em></p>
    <p><a href="/blog">← Back to Blog</a></p>
</div>

<div class="post-content">
    <p>We're excited to share the latest updates to our platform, designed to make content creation and discovery even better for our community.</p>
    
    <h2>What's New</h2>
    
    <h3>Enhanced Video Player</h3>
    <p>Our video player now includes improved accessibility features, better mobile responsiveness, and support for additional subtitle formats.</p>
    
    <h3>Advanced Search</h3>
    <p>Finding content is now easier with improved search filters, including date ranges, content types, and creator-specific searches.</p>
    
    <h3>Community Features</h3>
    <p>New tools for creators to engage with their audience, including enhanced comment moderation and community guidelines.</p>
    
    <h2>Coming Soon</h2>
    <p>We're working on additional features based on community feedback, including improved playlist management and enhanced mobile upload capabilities.</p>
    
    <p>Thank you for being part of our community and helping us build a platform that serves independent media creators worldwide.</p>
</div>

<div class="post-footer">
    <h3>Related Posts</h3>
    <ul>
        <li><a href="/blog/community-spotlight">Community Spotlight: Grassroots Filmmakers</a></li>
        <li><a href="/blog/category/platform-updates">All Platform Updates</a></li>
    </ul>
    
    <p><a href="/blog">View all blog posts</a></p>
</div>
```

### Curator Voice Example

Create a new page with:
- **Slug:** `voices/independent-media-impact`
- **Title:** `The Impact of Independent Media`
- **Description:**

```html
<h1>The Impact of Independent Media</h1>

<div class="curator-meta">
    <p><em>By Sarah Chen | January 12, 2025</em></p>
    <p><em>Community Curator • Social Impact Documentation</em></p>
    <p><a href="/voices">← Back to Curator Voices</a></p>
</div>

<div class="curator-bio">
    <p><strong>About the curator:</strong> Sarah Chen is a documentary filmmaker and digital media strategist with over a decade of experience in community-driven storytelling and platform development.</p>
</div>

<div class="voice-content">
    <p>As someone who has worked in independent media for over ten years, I've witnessed firsthand how platforms like ours are transforming the way stories are told and shared.</p>
    
    <h2>The Power of Community-Driven Platforms</h2>
    <p>Unlike mainstream platforms driven by algorithms and advertising revenue, community-focused platforms prioritize meaningful content and authentic storytelling. This shift has profound implications for both creators and audiences.</p>
    
    <h2>Challenges and Opportunities</h2>
    <p>Independent media faces unique challenges: limited budgets, smaller audiences, and the need to balance sustainability with mission-driven content. However, these constraints often lead to more creative and impactful storytelling.</p>
    
    <h2>The Role of Curation</h2>
    <p>Curation isn't just about organizing content—it's about creating pathways for discovery and building bridges between diverse communities and perspectives.</p>
    
    <h2>Looking Forward</h2>
    <p>The future of independent media lies in platforms that understand the importance of community, context, and genuine engagement over viral metrics and advertising revenue.</p>
</div>

<div class="voice-footer">
    <h3>More from this Curator</h3>
    <ul>
        <li><a href="/voices/community-engagement-strategies">Building Authentic Community Engagement</a></li>
    </ul>
    
    <p><a href="/voices">Read more curator voices</a></p>
</div>
```

## Step 6: Verify Implementation

### Check Sidebar Navigation
- Visit your site's homepage
- Verify "Blog" and "Curator Voices" links appear in the sidebar
- Confirm they're positioned correctly in the navigation

### Test URLs
- Main pages: `/blog` and `/voices` should display your content
- Nested pages: `/blog/platform-updates` and `/voices/independent-media-impact` should work
- All internal links should navigate correctly

### Browser Testing
- Test in multiple browsers
- Verify mobile responsiveness
- Check that all TinyMCE formatting displays correctly

## Content Management

### Adding New Content

**For Blog Posts:**
1. Go to Django Admin > Files > Pages
2. Click "Add Page"
3. Use slug format: `blog/your-post-title`
4. Add content using TinyMCE editor
5. Update main blog page with links to new posts

**For Curator Voices:**
1. Follow same process as blog posts
2. Use slug format: `voices/your-article-title`
3. Include curator bio and contact information
4. Update main voices page with new articles

### Content Organization

**Recommended slug patterns:**
- Blog categories: `blog/category/category-name`
- Blog posts: `blog/descriptive-post-title`
- Curator articles: `voices/curator-topic-title`
- Curator profiles: `voices/curator/curator-name`

### TinyMCE Tips

- Use the **Preview** button to check formatting
- Upload images directly through the editor
- Use **Heading 2** (h2) for main sections
- Keep HTML clean by using editor tools rather than custom code
- Save frequently when editing long content

## Troubleshooting

### Sidebar Links Not Appearing
- Check JavaScript syntax in `contents.html`
- Clear browser cache with hard refresh (Ctrl+F5)
- Verify application was restarted after configuration changes
- Check browser console for JavaScript errors

### "You are lost" Errors
- Ensure page slugs in Django Admin exactly match URLs
- Check for extra spaces in slug fields
- Verify pages were saved successfully in Django Admin

### Nested URLs Not Working
- Confirm URL pattern change in `files/urls.py` is correct
- Ensure application was properly restarted
- Check server error logs for detailed error messages

### TinyMCE Issues
- Run `python manage.py collectstatic --noinput` to update static files
- Check that media directory has proper write permissions
- Verify TinyMCE configuration in Django settings

## Customization Options

### Icons
Icons use Material Icons. Browse the full collection at [Material Icons](https://fonts.google.com/icons) and update the `icon` values in the configuration.

**Popular alternatives:**
- Blog: `'article'`, `'edit'`, `'library_books'`, `'description'`
- Voices: `'record_voice_over'`, `'mic'`, `'campaign'`, `'speaker_notes'`

### Additional Pages
Add more pages to the same section by extending the `mainMenuExtraItems` array:

```javascript
mainMenuExtraItems: [{
    text: "Playlists",
    link: "/user/admin/playlists",
    icon: 'playlist_play',
}, {
    text: "Blog",
    link: "/blog",
    icon: 'article',
}, {
    text: "Curator Voices",
    link: "/voices",
    icon: 'record_voice_over',
}, {
    text: "Resources",
    link: "/resources",
    icon: 'library_books',
}],
```

### Styling
Add custom CSS for blog and curator content:

```css
.blog-post, .curator-voice {
    border-bottom: 1px solid #eee;
    padding-bottom: 1rem;
    margin-bottom: 1.5rem;
}

.post-meta, .curator-meta {
    font-style: italic;
    color: #666;
    margin-bottom: 1rem;
}

.post-footer, .voice-footer {
    border-top: 1px solid #eee;
    padding-top: 1rem;
    margin-top: 2rem;
}
```

## Security Considerations

- Only grant admin access to trusted users who need to create/edit content
- Use Django's built-in permission system to control page editing access
- Regularly review and moderate content for community guidelines compliance
- Consider implementing content approval workflows for multi-user environments

## Performance Tips

- Optimize images before uploading through TinyMCE
- Use descriptive but concise page titles for better SEO
- Implement caching if your site has high traffic
- Monitor page load times, especially for pages with many images

---

## Summary

This implementation adds flexible blog and curator voice functionality to CinemataCMS while leveraging the existing page system and TinyMCE editor. The nested URL structure allows for organized content hierarchies, and the sidebar integration provides easy navigation for users.

The system scales well for growing content needs and maintains the platform's focus on community-driven media while adding publishing capabilities for organizations and curators.
