"""Contract PDF Generator using WeasyPrint for HTML to PDF conversion."""
import logging
from datetime import date
from io import BytesIO
from typing import Optional
import difflib

logger = logging.getLogger(__name__)


def format_uk_date(d: Optional[date]) -> str:
    """Format date as DD Month YYYY."""
    if d is None:
        return ""
    return d.strftime("%d %B %Y")


def generate_contract_pdf(
    html_content: str,
    contract_name: str,
    version_number: int,
    venue_name: str = "Equestrian Venue",
    signer_name: Optional[str] = None,
    sign_date: Optional[date] = None,
    include_signature_placeholder: bool = True
) -> bytes:
    """
    Generate a contract PDF from HTML content.

    Args:
        html_content: The contract content in HTML format
        contract_name: Name of the contract
        version_number: Version number of the contract
        venue_name: Name of the venue
        signer_name: Name of the person signing (optional)
        sign_date: Date of signing (optional)
        include_signature_placeholder: Whether to include /sig1/ placeholder

    Returns:
        PDF as bytes
    """
    try:
        from weasyprint import HTML, CSS
    except ImportError:
        logger.error("WeasyPrint library not installed. Run: pip install weasyprint")
        raise ImportError("WeasyPrint library required. Install with: pip install weasyprint")

    # Build the complete HTML document with styling
    signature_section = ""
    if include_signature_placeholder:
        signature_info = ""
        if signer_name:
            signature_info += f"<p><strong>Signed by:</strong> {signer_name}</p>"
        if sign_date:
            signature_info += f"<p><strong>Date:</strong> {format_uk_date(sign_date)}</p>"

        signature_section = f"""
        <div class="signature-section">
            <h3>Signature</h3>
            {signature_info}
            <div class="signature-box">
                <p>/sig1/</p>
            </div>
            <p class="signature-instruction">Please sign above</p>
        </div>
        """

    full_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @page {{
                size: A4;
                margin: 25mm 20mm 25mm 20mm;
                @bottom-right {{
                    content: "Page " counter(page) " of " counter(pages);
                    font-size: 9pt;
                    color: #666;
                }}
            }}

            body {{
                font-family: 'Helvetica', 'Arial', sans-serif;
                font-size: 11pt;
                line-height: 1.6;
                color: #333;
            }}

            .header {{
                border-bottom: 2px solid #2c5282;
                padding-bottom: 15px;
                margin-bottom: 25px;
            }}

            .header h1 {{
                color: #2c5282;
                font-size: 24pt;
                margin: 0 0 5px 0;
            }}

            .header .venue-name {{
                color: #4a5568;
                font-size: 14pt;
                margin: 0;
            }}

            .header .version {{
                color: #718096;
                font-size: 10pt;
                margin-top: 10px;
            }}

            .content {{
                text-align: justify;
            }}

            .content h1, .content h2, .content h3 {{
                color: #2c5282;
                margin-top: 20px;
            }}

            .content h1 {{ font-size: 18pt; }}
            .content h2 {{ font-size: 14pt; }}
            .content h3 {{ font-size: 12pt; }}

            .content p {{
                margin-bottom: 12px;
            }}

            .content ul, .content ol {{
                margin-left: 20px;
                margin-bottom: 12px;
            }}

            .content li {{
                margin-bottom: 6px;
            }}

            .content table {{
                width: 100%;
                border-collapse: collapse;
                margin: 15px 0;
            }}

            .content th, .content td {{
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
            }}

            .content th {{
                background-color: #f7fafc;
                font-weight: bold;
            }}

            .signature-section {{
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
                page-break-inside: avoid;
            }}

            .signature-section h3 {{
                color: #2c5282;
                margin-bottom: 15px;
            }}

            .signature-box {{
                border: 1px dashed #999;
                height: 60px;
                width: 300px;
                margin: 20px 0;
                display: flex;
                align-items: center;
                justify-content: center;
            }}

            .signature-box p {{
                color: #ccc;
                font-size: 10pt;
            }}

            .signature-instruction {{
                font-size: 9pt;
                color: #666;
                font-style: italic;
            }}

            /* Styles for change highlighting */
            .addition {{
                background-color: #c6f6d5;
                padding: 2px 4px;
            }}

            .deletion {{
                background-color: #fed7d7;
                text-decoration: line-through;
                padding: 2px 4px;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>{contract_name}</h1>
            <p class="venue-name">{venue_name}</p>
            <p class="version">Version {version_number}</p>
        </div>

        <div class="content">
            {html_content}
        </div>

        {signature_section}
    </body>
    </html>
    """

    # Generate PDF
    html_doc = HTML(string=full_html)
    pdf_bytes = html_doc.write_pdf()

    return pdf_bytes


def generate_diff_html(old_html: str, new_html: str) -> str:
    """
    Generate HTML showing the differences between two versions.
    Additions are highlighted in green, deletions in red with strikethrough.

    Args:
        old_html: Previous version HTML content
        new_html: New version HTML content

    Returns:
        HTML string with differences highlighted
    """
    # Split HTML into lines for comparison
    old_lines = old_html.splitlines(keepends=True)
    new_lines = new_html.splitlines(keepends=True)

    # Use difflib to find differences
    differ = difflib.HtmlDiff()

    # For a simpler approach, use unified diff and mark changes
    diff = difflib.unified_diff(old_lines, new_lines, lineterm='')

    result_lines = []
    for line in diff:
        if line.startswith('+++') or line.startswith('---'):
            continue  # Skip file headers
        elif line.startswith('@@'):
            continue  # Skip hunk headers
        elif line.startswith('+'):
            # Addition
            result_lines.append(f'<span class="addition">{line[1:]}</span>')
        elif line.startswith('-'):
            # Deletion
            result_lines.append(f'<span class="deletion">{line[1:]}</span>')
        else:
            # Unchanged
            result_lines.append(line[1:] if line.startswith(' ') else line)

    return ''.join(result_lines)


def generate_side_by_side_diff_html(old_html: str, new_html: str, old_version: int, new_version: int) -> str:
    """
    Generate a side-by-side comparison view of two contract versions.

    Args:
        old_html: Previous version HTML content
        new_html: New version HTML content
        old_version: Previous version number
        new_version: New version number

    Returns:
        HTML string with side-by-side comparison
    """
    differ = difflib.HtmlDiff(wrapcolumn=60)

    diff_table = differ.make_table(
        old_html.splitlines(),
        new_html.splitlines(),
        fromdesc=f'Version {old_version}',
        todesc=f'Version {new_version}',
        context=True,
        numlines=3
    )

    # Wrap in styled container
    styled_html = f"""
    <style>
        .diff {{
            font-family: monospace;
            font-size: 10pt;
        }}
        .diff_header {{
            background-color: #e8e8e8;
            padding: 8px;
            font-weight: bold;
        }}
        .diff_next {{
            background-color: #c0c0c0;
        }}
        .diff_add {{
            background-color: #aaffaa;
        }}
        .diff_chg {{
            background-color: #ffff77;
        }}
        .diff_sub {{
            background-color: #ffaaaa;
        }}
        table.diff {{
            width: 100%;
            border-collapse: collapse;
        }}
        table.diff td {{
            padding: 4px;
            vertical-align: top;
        }}
    </style>
    <div class="diff">
        {diff_table}
    </div>
    """

    return styled_html


def generate_inline_diff_html(old_html: str, new_html: str) -> str:
    """
    Generate inline diff showing word-level changes.
    More suitable for contracts where paragraph structure matters.

    Args:
        old_html: Previous version HTML content
        new_html: New version HTML content

    Returns:
        HTML string with inline changes marked
    """
    import re

    # Tokenize by words while preserving HTML tags
    def tokenize(text):
        # Split on HTML tags and words
        pattern = r'(<[^>]+>|\s+|\S+)'
        return re.findall(pattern, text)

    old_tokens = tokenize(old_html)
    new_tokens = tokenize(new_html)

    # Use SequenceMatcher for word-level diff
    matcher = difflib.SequenceMatcher(None, old_tokens, new_tokens)

    result = []
    for opcode, i1, i2, j1, j2 in matcher.get_opcodes():
        if opcode == 'equal':
            result.extend(new_tokens[j1:j2])
        elif opcode == 'replace':
            # Show deletion then addition
            deleted = ''.join(old_tokens[i1:i2])
            added = ''.join(new_tokens[j1:j2])
            if deleted.strip():
                result.append(f'<span class="deletion">{deleted}</span>')
            if added.strip():
                result.append(f'<span class="addition">{added}</span>')
        elif opcode == 'delete':
            deleted = ''.join(old_tokens[i1:i2])
            if deleted.strip():
                result.append(f'<span class="deletion">{deleted}</span>')
        elif opcode == 'insert':
            added = ''.join(new_tokens[j1:j2])
            if added.strip():
                result.append(f'<span class="addition">{added}</span>')

    return ''.join(result)
