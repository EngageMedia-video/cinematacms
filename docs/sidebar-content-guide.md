# CinemataCMS Sidebar Content Guide

This guide explains how to add content to the sidebar menu items in CinemataCMS, specifically for the "About", "Editorial Policy", and other pages accessible from the sidebar navigation.

## Overview

The CinemataCMS sidebar contains navigational links to important pages such as:
- About Cinemata
- Editorial Policy
- Contact

These links are defined in the template configuration, but the actual content is stored in the Django database as `Page` objects. When these pages don't exist, users will see a "you are lost" error message.

## Prerequisites

- Administrator access to your CinemataCMS installation
- Basic understanding of HTML for content formatting

## Step 1: Access the Admin Panel

1. Log in to your CinemataCMS installation
2. Navigate to the admin area, typically at `/admin/`
3. Enter your admin credentials

## Step 2: Create a New Page

1. In the admin dashboard, find and click on **Pages** under the Files section
2. Click the **Add Page** button in the top right corner

## Step 3: Configure the Page

For each sidebar item, you'll need to create a separate page with the following fields:

| Field | Description |
|-------|-------------|
| Slug | The URL-friendly name that will appear in the browser address bar (e.g., `about`, `editorial-policy`) |
| Title | The page title that appears at the top of the page and in browser tabs |
| Description | The actual content of the page (supports HTML) |

### Important Note About Slugs

The slug must exactly match the path defined in the sidebar menu configuration. The default configuration in `templates/config/installation/contents.html` includes:

```html
navMenuItems: [{
    text: "About Cinemata",
    link: "/about",
    icon: 'contact_support',
}, {
    text: "Editorial policy",
    link: "/editorial-policy",
    icon: 'description',
}, {
    text: "Contact",
    link: "/contact",
    icon: 'alternate_email',
}]
```

So your page slugs should be:
- `about` for the About page
- `editorial-policy` for the Editorial Policy page
- `contact` for the Contact page

## Step 4: Creating Specific Pages

### About Page

1. **Slug**: `about`
2. **Title**: `About Cinemata`
3. **Description**: Use the rich text editor to include content about your organization. Typically includes:
   - Mission statement
   - History of the organization
   - Team information
   - Partnership details

### Editorial Policy Page

1. **Slug**: `editorial-policy`
2. **Title**: `Editorial Policy`
3. **Description**: Explain your content guidelines, including:
   - What content is accepted
   - Content review process
   - Copyright and licensing information
   - Community guidelines

### Help & Resources Page

1. **Slug**: `help`
2. **Title**: `Help & Resources`
3. **Description**: Provide helpful information for users, including:
   - How to use the platform
   - Uploading guidelines
   - FAQ section
   - Troubleshooting tips
   - Links to additional resources
   - Tutorial videos or instructions

### Contact Page

1. **Slug**: `contact`
2. **Title**: `Contact Us`
3. **Description**: Provide contact information and possibly an embedded contact form.

## Step 5: Content Formatting

The Description field uses CKEditor, which provides rich text formatting. You can:
- Format text with bold, italic, etc.
- Create headings and lists
- Insert links and images
- Add tables for structured information

### Example HTML Content

### Example HTML for About Page

```html
<h1>About Cinemata</h1>

<p><em><strong>Cinemata is a platform for social and environmental films about the Asia-Pacific region.</strong></em></p>

<p>Cinemata uses the power of video, the Internet and open technologies to create social and environmental change. We harness old and new media to assist movements challenge social injustice and environmental damage, as well as to present solutions.</p>

<h2>Organizational Aims</h2>

<ul class="tick-list">
    <li>Engage communities and networks in the production and distribution of social and environmental justice media.</li>
    <li>Strengthen social movements by fostering and mobilizing networks of media makers, activists and technologists.</li>
    <li>Amplify the impact of campaigners and media makers by building skills in video production, distribution, and engagement.</li>
</ul>

<h2>The Team</h2>

<p>Our team includes members from across the Asia-Pacific region, with offices in Indonesia and Australia, and team members in Thailand, Malaysia, and the Philippines.</p>
```

### Example HTML for Help & Resources Page

```html
<h1>Help & Resources</h1>

<p>Welcome to Cinemata's Help & Resources center. Here you'll find everything you need to make the most of our platform.</p>

<h2>Getting Started</h2>

<div class="help-section">
    <h3>Creating an Account</h3>
    <p>To fully participate in the Cinemata community:</p>
    <ol>
        <li>Click the "Sign Up" button in the top right corner</li>
        <li>Fill in your details and verify your email address</li>
        <li>Complete your profile to help others find your content</li>
    </ol>
</div>

<h2>Uploading Content</h2>

<div class="help-section">
    <h3>Video Guidelines</h3>
    <p>Before uploading, please ensure your content:</p>
    <ul class="tick-list">
        <li>Focuses on social or environmental issues in the Asia-Pacific region</li>
        <li>Complies with our <a href="/editorial-policy">Editorial Policy</a></li>
        <li>Is properly licensed (see our <a href="/creative-commons">Creative Commons</a> guide)</li>
        <li>Has good quality audio and video</li>
    </ul>
    
    <h3>Upload Steps</h3>
    <ol>
        <li>Click "Upload" in the navigation menu</li>
        <li>Drag and drop your video file or click to browse</li>
        <li>Fill in all required metadata fields</li>
        <li>Add relevant tags to help others discover your content</li>
        <li>Choose the appropriate license for your work</li>
    </ol>
</div>

<h2>FAQ</h2>

<div class="help-section faq">
    <div class="faq-item">
        <h3>What file formats are supported?</h3>
        <p>Cinemata supports most common video formats including MP4, MOV, AVI, and WebM.</p>
    </div>
    
    <div class="faq-item">
        <h3>What is the maximum file size?</h3>
        <p>Regular users can upload files up to 500MB. Trusted Users can upload up to 5GB per file.</p>
    </div>
    
    <div class="faq-item">
        <h3>How do I become a Trusted User?</h3>
        <p>After contributing quality content regularly, you can apply through the Contact page.</p>
    </div>
    
    <div class="faq-item">
        <h3>How can I add subtitles to my videos?</h3>
        <p>After uploading, go to your video page and click "Add Subtitle" to upload SRT or VTT files.</p>
    </div>
    
    <div class="faq-item">
        <h3>Can I edit my video after uploading?</h3>
        <p>You cannot edit the video file itself, but you can update all metadata, thumbnails, and subtitles.</p>
    </div>
</div>

<h2>Need More Help?</h2>

<p>If you couldn't find the answer to your question, please <a href="/contact">contact us</a> and we'll be happy to assist you.</p>
```

## Step 6: Save and Verify

1. Click the **Save** button after creating each page
2. Navigate to your CinemataCMS frontend
3. Click on the sidebar links to verify that they now display your content instead of the error message

## Customizing the Sidebar Menu

If you want to add, remove, or change the sidebar menu items themselves, you'll need to edit:

1. `templates/config/installation/contents.html`
2. Look for the `navMenuItems` section
3. Add or modify the menu items as needed
4. Create corresponding pages with matching slugs in the admin panel

## Troubleshooting

- **"You are lost" error persists**: Double-check that the slug exactly matches the path in the sidebar link (without the leading slash)
- **Formatting issues**: Verify your HTML in the Description field is valid
- **Changes not appearing**: Clear your browser cache or try a private/incognito window

## Additional Resources

For more customization options:
- Refer to the Django admin documentation
- Review CKEditor documentation for advanced content formatting
- Check the CinemataCMS GitHub repository for template customization options

## Adding a Custom "Help & Resources" Link to the Sidebar

If "Help & Resources" is not already in your sidebar menu, you'll need to add it to the configuration:

1. Open the file `templates/config/installation/contents.html`
2. Locate the `navMenuItems` section
3. Add a new menu item for Help & Resources:

```javascript
{
    text: "Help & Resources",
    link: "/help",
    icon: 'help_outline',
},
```

4. Place this entry at the desired position in the menu items array
5. Save the file
6. Restart your application server if needed
7. Create the corresponding page with the slug "help" in the admin panel following the steps described above
