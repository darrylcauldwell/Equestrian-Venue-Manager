"""PDF Invoice Generator using ReportLab."""
import os
from datetime import date
from decimal import Decimal
from io import BytesIO
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.enums import TA_RIGHT, TA_CENTER


def format_uk_date(d: Optional[date]) -> str:
    """Format date as DD/MM/YYYY."""
    if d is None:
        return ""
    return d.strftime("%d/%m/%Y")


def format_currency(amount: Decimal) -> str:
    """Format amount as GBP currency."""
    return f"£{amount:,.2f}"


def generate_invoice_pdf(
    invoice_number: str,
    issue_date: date,
    due_date: date,
    period_start: date,
    period_end: date,
    customer_name: str,
    customer_email: str,
    line_items: list,  # List of dicts with description, quantity, unit_price, amount
    subtotal: Decimal,
    payments_received: Decimal,
    balance_due: Decimal,
    notes: Optional[str] = None,
    venue_name: str = "Equestrian Venue",
    venue_address: str = "Example Lane\nSomewhere, County\nAB1 2CD",
    venue_phone: str = "01onal 123456",
    venue_email: str = "info@venue.example.com",
) -> bytes:
    """
    Generate a professional invoice PDF.

    Returns the PDF as bytes.
    """
    buffer = BytesIO()

    # Create document
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20*mm,
        leftMargin=20*mm,
        topMargin=20*mm,
        bottomMargin=20*mm
    )

    # Styles
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='InvoiceTitle',
        fontSize=24,
        spaceAfter=10,
        textColor=colors.HexColor('#2c5282'),
        fontName='Helvetica-Bold'
    ))
    styles.add(ParagraphStyle(
        name='InvoiceNumber',
        fontSize=14,
        textColor=colors.HexColor('#4a5568'),
        fontName='Helvetica-Bold'
    ))
    styles.add(ParagraphStyle(
        name='VenueName',
        fontSize=16,
        textColor=colors.HexColor('#2c5282'),
        fontName='Helvetica-Bold'
    ))
    styles.add(ParagraphStyle(
        name='VenueDetails',
        fontSize=9,
        textColor=colors.HexColor('#718096'),
        leading=12
    ))
    styles.add(ParagraphStyle(
        name='SectionHeader',
        fontSize=11,
        textColor=colors.HexColor('#2c5282'),
        fontName='Helvetica-Bold',
        spaceAfter=5
    ))
    styles.add(ParagraphStyle(
        name='CustomerDetails',
        fontSize=10,
        leading=14
    ))
    styles.add(ParagraphStyle(
        name='Notes',
        fontSize=9,
        textColor=colors.HexColor('#718096'),
        leading=12
    ))
    styles.add(ParagraphStyle(
        name='RightAlign',
        fontSize=10,
        alignment=TA_RIGHT
    ))
    styles.add(ParagraphStyle(
        name='TotalLabel',
        fontSize=11,
        fontName='Helvetica-Bold',
        alignment=TA_RIGHT
    ))
    styles.add(ParagraphStyle(
        name='BalanceDue',
        fontSize=14,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#2c5282'),
        alignment=TA_RIGHT
    ))

    elements = []

    # Header section
    header_data = [
        [
            Paragraph(venue_name, styles['VenueName']),
            Paragraph("INVOICE", styles['InvoiceTitle'])
        ],
        [
            Paragraph(venue_address.replace('\n', '<br/>'), styles['VenueDetails']),
            Paragraph(f"Invoice No: {invoice_number}", styles['InvoiceNumber'])
        ],
        [
            Paragraph(f"Tel: {venue_phone}<br/>Email: {venue_email}", styles['VenueDetails']),
            Paragraph(f"Date: {format_uk_date(issue_date)}", styles['RightAlign'])
        ]
    ]

    header_table = Table(header_data, colWidths=[100*mm, 70*mm])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 15*mm))

    # Bill To and Invoice Details
    details_data = [
        [
            Paragraph("Bill To:", styles['SectionHeader']),
            Paragraph("Invoice Details:", styles['SectionHeader'])
        ],
        [
            Paragraph(f"{customer_name}<br/>{customer_email}", styles['CustomerDetails']),
            Paragraph(
                f"Due Date: {format_uk_date(due_date)}<br/>"
                f"Period: {format_uk_date(period_start)} - {format_uk_date(period_end)}",
                styles['CustomerDetails']
            )
        ]
    ]

    details_table = Table(details_data, colWidths=[85*mm, 85*mm])
    details_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(details_table)
    elements.append(Spacer(1, 10*mm))

    # Line items table
    items_header = ['Description', 'Qty', 'Unit Price', 'Amount']
    items_data = [items_header]

    for item in line_items:
        items_data.append([
            item.get('description', ''),
            f"{item.get('quantity', 1):.0f}" if item.get('quantity', 1) == int(item.get('quantity', 1)) else f"{item.get('quantity', 1):.2f}",
            format_currency(item.get('unit_price', Decimal('0'))),
            format_currency(item.get('amount', Decimal('0')))
        ])

    items_table = Table(items_data, colWidths=[95*mm, 20*mm, 27*mm, 28*mm])
    items_table.setStyle(TableStyle([
        # Header row
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),

        # Data rows
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 6),

        # Alignment
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),

        # Grid
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),

        # Alternating row colors
        *[('BACKGROUND', (0, i), (-1, i), colors.HexColor('#f7fafc'))
          for i in range(2, len(items_data), 2)]
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 5*mm))

    # Totals section
    totals_data = [
        ['', '', 'Subtotal:', format_currency(subtotal)],
        ['', '', 'Payments Received:', format_currency(payments_received)],
    ]

    totals_table = Table(totals_data, colWidths=[95*mm, 20*mm, 27*mm, 28*mm])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(totals_table)

    # Balance due (highlighted)
    balance_data = [
        ['', '', 'Balance Due:', format_currency(balance_due)]
    ]
    balance_table = Table(balance_data, colWidths=[95*mm, 20*mm, 27*mm, 28*mm])
    balance_table.setStyle(TableStyle([
        ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (2, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (2, 0), (-1, -1), 12),
        ('TEXTCOLOR', (2, 0), (-1, -1), colors.HexColor('#2c5282')),
        ('BACKGROUND', (2, 0), (-1, 0), colors.HexColor('#ebf4ff')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(balance_table)
    elements.append(Spacer(1, 10*mm))

    # Notes section
    if notes:
        elements.append(Paragraph("Notes:", styles['SectionHeader']))
        elements.append(Paragraph(notes, styles['Notes']))
        elements.append(Spacer(1, 5*mm))

    # Footer
    elements.append(Spacer(1, 10*mm))
    footer_text = (
        "Payment is due by the due date shown above. "
        "Please contact us if you have any questions about this invoice.<br/><br/>"
        "Thank you for your business!"
    )
    elements.append(Paragraph(footer_text, styles['Notes']))

    # Build PDF
    doc.build(elements)

    pdf_bytes = buffer.getvalue()
    buffer.close()

    return pdf_bytes


def generate_insurance_statement_pdf(
    statement_number: str,
    statement_date: date,
    period_start: date,
    period_end: date,
    customer_name: str,
    customer_email: str,
    horse_name: Optional[str],
    line_items: list,  # List of dicts with service_date, service_name, horse_name, description, amount
    total_amount: Decimal,
    notes: Optional[str] = None,
    venue_name: str = "Equestrian Venue",
    venue_address: str = "Example Lane\nSomewhere, County\nAB1 2CD",
    venue_phone: str = "01234 567890",
    venue_email: str = "info@venue.example.com",
) -> bytes:
    """
    Generate an insurance claim statement PDF.

    Returns the PDF as bytes.
    """
    buffer = BytesIO()

    # Create document with comfortable margins
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15*mm,
        leftMargin=15*mm,
        topMargin=15*mm,
        bottomMargin=15*mm
    )

    # Define colors
    primary_green = colors.HexColor('#276749')
    light_green = colors.HexColor('#f0fff4')
    accent_green = colors.HexColor('#c6f6d5')
    dark_gray = colors.HexColor('#2d3748')
    medium_gray = colors.HexColor('#4a5568')
    light_gray = colors.HexColor('#718096')
    border_gray = colors.HexColor('#cbd5e0')

    # Styles
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='InsTitle',
        fontSize=24,
        spaceAfter=5,
        textColor=primary_green,
        fontName='Helvetica-Bold',
        alignment=TA_CENTER
    ))
    styles.add(ParagraphStyle(
        name='InsSubtitle',
        fontSize=11,
        textColor=medium_gray,
        fontName='Helvetica',
        alignment=TA_CENTER
    ))
    styles.add(ParagraphStyle(
        name='InsVenueName',
        fontSize=18,
        textColor=primary_green,
        fontName='Helvetica-Bold',
        alignment=TA_CENTER
    ))
    styles.add(ParagraphStyle(
        name='InsVenueDetails',
        fontSize=10,
        textColor=light_gray,
        leading=14,
        alignment=TA_CENTER
    ))
    styles.add(ParagraphStyle(
        name='InsSectionHeader',
        fontSize=12,
        textColor=primary_green,
        fontName='Helvetica-Bold',
        spaceBefore=10,
        spaceAfter=5
    ))
    styles.add(ParagraphStyle(
        name='InsLabel',
        fontSize=10,
        textColor=light_gray,
        fontName='Helvetica-Bold'
    ))
    styles.add(ParagraphStyle(
        name='InsValue',
        fontSize=11,
        textColor=dark_gray,
        leading=16
    ))
    styles.add(ParagraphStyle(
        name='InsBody',
        fontSize=10,
        textColor=dark_gray,
        leading=14
    ))
    styles.add(ParagraphStyle(
        name='InsCertification',
        fontSize=9,
        textColor=medium_gray,
        leading=13
    ))
    styles.add(ParagraphStyle(
        name='InsTableCell',
        fontSize=9,
        textColor=dark_gray,
        leading=12
    ))

    elements = []

    # ===== HEADER SECTION =====
    elements.append(Paragraph(venue_name, styles['InsVenueName']))
    if venue_address:
        address_inline = venue_address.replace('\n', ' • ')
        elements.append(Paragraph(address_inline, styles['InsVenueDetails']))
    if venue_phone or venue_email:
        contact_parts = []
        if venue_phone:
            contact_parts.append(f"Tel: {venue_phone}")
        if venue_email:
            contact_parts.append(f"Email: {venue_email}")
        elements.append(Paragraph(" • ".join(contact_parts), styles['InsVenueDetails']))

    elements.append(Spacer(1, 8*mm))

    # Title with decorative line
    elements.append(Paragraph("INSURANCE CLAIM STATEMENT", styles['InsTitle']))
    elements.append(Spacer(1, 3*mm))

    # Divider line
    divider_data = [['', '', '']]
    divider = Table(divider_data, colWidths=[60*mm, 60*mm, 60*mm])
    divider.setStyle(TableStyle([
        ('LINEABOVE', (1, 0), (1, 0), 2, primary_green),
    ]))
    elements.append(divider)
    elements.append(Spacer(1, 8*mm))

    # ===== STATEMENT INFO BOX =====
    info_data = [
        [
            Paragraph("<b>Statement Number:</b>", styles['InsLabel']),
            Paragraph(statement_number, styles['InsValue']),
            Paragraph("<b>Statement Date:</b>", styles['InsLabel']),
            Paragraph(format_uk_date(statement_date), styles['InsValue'])
        ],
        [
            Paragraph("<b>Period From:</b>", styles['InsLabel']),
            Paragraph(format_uk_date(period_start), styles['InsValue']),
            Paragraph("<b>Period To:</b>", styles['InsLabel']),
            Paragraph(format_uk_date(period_end), styles['InsValue'])
        ]
    ]
    info_table = Table(info_data, colWidths=[35*mm, 55*mm, 30*mm, 55*mm])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('BACKGROUND', (0, 0), (-1, -1), light_green),
        ('BOX', (0, 0), (-1, -1), 1, border_gray),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 8*mm))

    # ===== CLAIMANT DETAILS =====
    elements.append(Paragraph("Claimant Details", styles['InsSectionHeader']))

    claimant_info = f"<b>{customer_name}</b><br/>{customer_email}"
    if horse_name:
        claimant_info += f"<br/>Horse: {horse_name}"

    claimant_data = [[Paragraph(claimant_info, styles['InsValue'])]]
    claimant_table = Table(claimant_data, colWidths=[180*mm])
    claimant_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fafafa')),
        ('BOX', (0, 0), (-1, -1), 1, border_gray),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
    ]))
    elements.append(claimant_table)
    elements.append(Spacer(1, 8*mm))

    # ===== SERVICES TABLE =====
    elements.append(Paragraph("Services Claimed", styles['InsSectionHeader']))

    # Table header
    header_style = ParagraphStyle('HeaderCell', fontSize=10, textColor=colors.white, fontName='Helvetica-Bold')
    items_header = [
        Paragraph('Date', header_style),
        Paragraph('Service', header_style),
        Paragraph('Horse', header_style),
        Paragraph('Description', header_style),
        Paragraph('Amount', header_style)
    ]
    items_data = [items_header]

    # Table rows with Paragraph for word wrapping
    for item in line_items:
        items_data.append([
            Paragraph(format_uk_date(item.get('service_date')), styles['InsTableCell']),
            Paragraph(item.get('service_name', ''), styles['InsTableCell']),
            Paragraph(item.get('horse_name', ''), styles['InsTableCell']),
            Paragraph(item.get('description', '') or '-', styles['InsTableCell']),
            Paragraph(f"<b>{format_currency(item.get('amount', Decimal('0')))}</b>", styles['InsTableCell'])
        ])

    # Adjusted column widths for better readability
    items_table = Table(items_data, colWidths=[22*mm, 38*mm, 30*mm, 60*mm, 25*mm])
    table_styles = [
        # Header row
        ('BACKGROUND', (0, 0), (-1, 0), primary_green),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),

        # Data rows
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),

        # Alignment
        ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),

        # Borders
        ('BOX', (0, 0), (-1, -1), 1, border_gray),
        ('LINEBELOW', (0, 0), (-1, 0), 1, primary_green),
        ('LINEBELOW', (0, 1), (-1, -2), 0.5, border_gray),
    ]

    # Alternating row colors
    for i in range(1, len(items_data)):
        if i % 2 == 0:
            table_styles.append(('BACKGROUND', (0, i), (-1, i), light_green))

    items_table.setStyle(TableStyle(table_styles))
    elements.append(items_table)

    # ===== TOTAL =====
    elements.append(Spacer(1, 3*mm))
    total_data = [
        ['', '', '', Paragraph('<b>TOTAL CLAIMED:</b>', styles['InsValue']),
         Paragraph(f"<b>{format_currency(total_amount)}</b>", styles['InsValue'])]
    ]
    total_table = Table(total_data, colWidths=[22*mm, 38*mm, 30*mm, 60*mm, 25*mm])
    total_table.setStyle(TableStyle([
        ('ALIGN', (-2, 0), (-1, -1), 'RIGHT'),
        ('BACKGROUND', (-2, 0), (-1, 0), accent_green),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (-1, 0), (-1, -1), 6),
        ('BOX', (-2, 0), (-1, 0), 1, primary_green),
    ]))
    elements.append(total_table)

    # ===== NOTES =====
    if notes:
        elements.append(Spacer(1, 8*mm))
        elements.append(Paragraph("Notes", styles['InsSectionHeader']))
        elements.append(Paragraph(notes, styles['InsBody']))

    # ===== CERTIFICATION BOX =====
    elements.append(Spacer(1, 12*mm))

    cert_text = (
        "<b>CERTIFICATION</b><br/><br/>"
        "I hereby certify that the services listed above were provided as described and that the "
        "amounts shown are accurate. This statement is provided for insurance claim purposes.<br/><br/>"
        f"<b>Issued by:</b> {venue_name}<br/>"
        f"<b>Date:</b> {format_uk_date(statement_date)}"
    )
    cert_data = [[Paragraph(cert_text, styles['InsCertification'])]]
    cert_table = Table(cert_data, colWidths=[180*mm])
    cert_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f7fafc')),
        ('BOX', (0, 0), (-1, -1), 1, border_gray),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
    ]))
    elements.append(cert_table)

    # Build PDF
    doc.build(elements)

    pdf_bytes = buffer.getvalue()
    buffer.close()

    return pdf_bytes


def generate_account_statement_pdf(
    user_name: str,
    user_email: str,
    transactions: list,
    from_date: date,
    to_date: date,
    opening_balance: Decimal,
    venue_name: str = "Equestrian Venue",
    venue_address: str = "Example Lane\nSomewhere, County\nAB1 2CD",
    venue_phone: str = "01234 567890",
    venue_email: str = "info@venue.example.com",
) -> bytes:
    """
    Generate an account statement PDF showing transactions and running balance.

    Returns the PDF as bytes.
    """
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20*mm,
        leftMargin=20*mm,
        topMargin=20*mm,
        bottomMargin=20*mm
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='StmtTitle',
        fontSize=22,
        spaceAfter=10,
        textColor=colors.HexColor('#2c5282'),
        fontName='Helvetica-Bold'
    ))
    styles.add(ParagraphStyle(
        name='StmtVenueName',
        fontSize=16,
        textColor=colors.HexColor('#2c5282'),
        fontName='Helvetica-Bold'
    ))
    styles.add(ParagraphStyle(
        name='StmtVenueDetails',
        fontSize=9,
        textColor=colors.HexColor('#718096'),
        leading=12
    ))
    styles.add(ParagraphStyle(
        name='StmtSectionHeader',
        fontSize=11,
        textColor=colors.HexColor('#2c5282'),
        fontName='Helvetica-Bold',
        spaceAfter=5
    ))
    styles.add(ParagraphStyle(
        name='StmtCustomerDetails',
        fontSize=10,
        leading=14
    ))
    styles.add(ParagraphStyle(
        name='StmtRightAlign',
        fontSize=10,
        alignment=TA_RIGHT
    ))
    styles.add(ParagraphStyle(
        name='StmtNotes',
        fontSize=9,
        textColor=colors.HexColor('#718096'),
        leading=12
    ))

    elements = []

    # Header
    header_data = [
        [
            Paragraph(venue_name, styles['StmtVenueName']),
            Paragraph("ACCOUNT<br/>STATEMENT", styles['StmtTitle'])
        ],
        [
            Paragraph(venue_address.replace('\n', '<br/>'), styles['StmtVenueDetails']),
            Paragraph(f"Generated: {format_uk_date(date.today())}", styles['StmtRightAlign'])
        ],
        [
            Paragraph(f"Tel: {venue_phone}<br/>Email: {venue_email}", styles['StmtVenueDetails']),
            ''
        ]
    ]

    header_table = Table(header_data, colWidths=[100*mm, 70*mm])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 15*mm))

    # Account holder and period
    details_data = [
        [
            Paragraph("Account Holder:", styles['StmtSectionHeader']),
            Paragraph("Statement Period:", styles['StmtSectionHeader'])
        ],
        [
            Paragraph(f"{user_name}<br/>{user_email}", styles['StmtCustomerDetails']),
            Paragraph(
                f"From: {format_uk_date(from_date)}<br/>"
                f"To: {format_uk_date(to_date)}",
                styles['StmtCustomerDetails']
            )
        ]
    ]

    details_table = Table(details_data, colWidths=[85*mm, 85*mm])
    details_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(details_table)
    elements.append(Spacer(1, 10*mm))

    # Opening balance
    elements.append(Paragraph(f"Opening Balance: {format_currency(opening_balance)}", styles['StmtSectionHeader']))
    elements.append(Spacer(1, 5*mm))

    # Transaction table
    items_header = ['Date', 'Description', 'Type', 'Debit', 'Credit', 'Balance']
    items_data = [items_header]

    running_balance = opening_balance
    for txn in transactions:
        amount = Decimal(str(txn.get('amount', 0)))
        running_balance += amount

        debit = format_currency(amount) if amount > 0 else ''
        credit = format_currency(abs(amount)) if amount < 0 else ''

        txn_date = txn.get('transaction_date')
        if hasattr(txn_date, 'date'):
            txn_date = txn_date.date()

        items_data.append([
            format_uk_date(txn_date),
            txn.get('description', '')[:45],
            txn.get('transaction_type', '').replace('_', ' ').title(),
            debit,
            credit,
            format_currency(running_balance)
        ])

    items_table = Table(items_data, colWidths=[22*mm, 55*mm, 28*mm, 22*mm, 22*mm, 22*mm])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('ALIGN', (3, 0), (-1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        *[('BACKGROUND', (0, i), (-1, i), colors.HexColor('#f7fafc'))
          for i in range(2, len(items_data), 2)]
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 5*mm))

    # Closing balance
    closing_data = [
        ['', '', '', '', 'Closing Balance:', format_currency(running_balance)]
    ]
    closing_table = Table(closing_data, colWidths=[22*mm, 55*mm, 28*mm, 22*mm, 22*mm, 22*mm])
    closing_table.setStyle(TableStyle([
        ('ALIGN', (-2, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (-2, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (-2, 0), (-1, -1), 11),
        ('TEXTCOLOR', (-2, 0), (-1, -1), colors.HexColor('#2c5282')),
        ('BACKGROUND', (-2, 0), (-1, 0), colors.HexColor('#ebf4ff')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(closing_table)
    elements.append(Spacer(1, 15*mm))

    # Footer
    balance_status = "in credit" if running_balance < 0 else "outstanding"
    footer_text = (
        f"Your account balance is {format_currency(abs(running_balance))} {balance_status}.<br/><br/>"
        "If you have any questions about this statement, please contact us.<br/>"
        "Thank you for your business!"
    )
    elements.append(Paragraph(footer_text, styles['StmtNotes']))

    doc.build(elements)

    pdf_bytes = buffer.getvalue()
    buffer.close()

    return pdf_bytes


def generate_payment_receipt_pdf(
    receipt_number: str,
    payment_date: date,
    customer_name: str,
    customer_email: str,
    amount: Decimal,
    payment_method: str,
    payment_reference: Optional[str] = None,
    notes: Optional[str] = None,
    venue_name: str = "Equestrian Venue",
    venue_address: str = "Example Lane\nSomewhere, County\nAB1 2CD",
    venue_phone: str = "01234 567890",
    venue_email: str = "info@venue.example.com",
) -> bytes:
    """
    Generate a payment receipt PDF.

    Returns the PDF as bytes.
    """
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=25*mm,
        leftMargin=25*mm,
        topMargin=25*mm,
        bottomMargin=25*mm
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='RcptTitle',
        fontSize=24,
        spaceAfter=10,
        textColor=colors.HexColor('#276749'),
        fontName='Helvetica-Bold',
        alignment=TA_CENTER
    ))
    styles.add(ParagraphStyle(
        name='RcptVenueName',
        fontSize=18,
        textColor=colors.HexColor('#276749'),
        fontName='Helvetica-Bold',
        alignment=TA_CENTER
    ))
    styles.add(ParagraphStyle(
        name='RcptVenueDetails',
        fontSize=10,
        textColor=colors.HexColor('#718096'),
        leading=14,
        alignment=TA_CENTER
    ))
    styles.add(ParagraphStyle(
        name='RcptSectionHeader',
        fontSize=11,
        textColor=colors.HexColor('#276749'),
        fontName='Helvetica-Bold',
        spaceAfter=5
    ))
    styles.add(ParagraphStyle(
        name='RcptDetails',
        fontSize=11,
        leading=16
    ))
    styles.add(ParagraphStyle(
        name='RcptAmount',
        fontSize=20,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#276749'),
        alignment=TA_CENTER
    ))
    styles.add(ParagraphStyle(
        name='RcptNotes',
        fontSize=10,
        textColor=colors.HexColor('#718096'),
        leading=14
    ))
    styles.add(ParagraphStyle(
        name='RcptThankYou',
        fontSize=14,
        textColor=colors.HexColor('#276749'),
        fontName='Helvetica-Bold',
        alignment=TA_CENTER,
        spaceBefore=20
    ))

    elements = []

    # Header
    elements.append(Paragraph(venue_name, styles['RcptVenueName']))
    elements.append(Paragraph(
        venue_address.replace('\n', '<br/>') + f"<br/>Tel: {venue_phone} | Email: {venue_email}",
        styles['RcptVenueDetails']
    ))
    elements.append(Spacer(1, 10*mm))

    # Title
    elements.append(Paragraph("PAYMENT RECEIPT", styles['RcptTitle']))
    elements.append(Spacer(1, 10*mm))

    # Receipt details box
    receipt_data = [
        ['Receipt Number:', receipt_number],
        ['Date:', format_uk_date(payment_date)],
        ['Received From:', customer_name],
        ['Email:', customer_email],
        ['Payment Method:', payment_method.replace('_', ' ').title()],
    ]
    if payment_reference:
        receipt_data.append(['Reference:', payment_reference])

    receipt_table = Table(receipt_data, colWidths=[45*mm, 95*mm])
    receipt_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#4a5568')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(receipt_table)
    elements.append(Spacer(1, 10*mm))

    # Amount box
    amount_data = [
        ['Amount Received'],
        [format_currency(abs(amount))]
    ]
    amount_table = Table(amount_data, colWidths=[160*mm])
    amount_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (-1, 1), 24),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#276749')),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#c6f6d5')),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('BOX', (0, 0), (-1, -1), 2, colors.HexColor('#276749')),
    ]))
    elements.append(amount_table)
    elements.append(Spacer(1, 10*mm))

    # Notes
    if notes:
        elements.append(Paragraph("Notes:", styles['RcptSectionHeader']))
        elements.append(Paragraph(notes, styles['RcptNotes']))
        elements.append(Spacer(1, 10*mm))

    # Thank you message
    elements.append(Paragraph("Thank you for your payment!", styles['RcptThankYou']))
    elements.append(Spacer(1, 15*mm))

    # Footer
    footer_text = (
        "This receipt confirms payment has been received and credited to your account.<br/>"
        "Please retain this receipt for your records."
    )
    elements.append(Paragraph(footer_text, styles['RcptNotes']))

    doc.build(elements)

    pdf_bytes = buffer.getvalue()
    buffer.close()

    return pdf_bytes
