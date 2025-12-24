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
        name='InsTitle',
        fontSize=22,
        spaceAfter=10,
        textColor=colors.HexColor('#276749'),
        fontName='Helvetica-Bold'
    ))
    styles.add(ParagraphStyle(
        name='InsNumber',
        fontSize=12,
        textColor=colors.HexColor('#4a5568'),
        fontName='Helvetica-Bold'
    ))
    styles.add(ParagraphStyle(
        name='InsVenueName',
        fontSize=16,
        textColor=colors.HexColor('#276749'),
        fontName='Helvetica-Bold'
    ))
    styles.add(ParagraphStyle(
        name='InsVenueDetails',
        fontSize=9,
        textColor=colors.HexColor('#718096'),
        leading=12
    ))
    styles.add(ParagraphStyle(
        name='InsSectionHeader',
        fontSize=11,
        textColor=colors.HexColor('#276749'),
        fontName='Helvetica-Bold',
        spaceAfter=5
    ))
    styles.add(ParagraphStyle(
        name='InsCustomerDetails',
        fontSize=10,
        leading=14
    ))
    styles.add(ParagraphStyle(
        name='InsNotes',
        fontSize=9,
        textColor=colors.HexColor('#718096'),
        leading=12
    ))
    styles.add(ParagraphStyle(
        name='InsRightAlign',
        fontSize=10,
        alignment=TA_RIGHT
    ))
    styles.add(ParagraphStyle(
        name='InsTotalLabel',
        fontSize=12,
        fontName='Helvetica-Bold',
        alignment=TA_RIGHT
    ))

    elements = []

    # Header section
    header_data = [
        [
            Paragraph(venue_name, styles['InsVenueName']),
            Paragraph("INSURANCE CLAIM<br/>STATEMENT", styles['InsTitle'])
        ],
        [
            Paragraph(venue_address.replace('\n', '<br/>'), styles['InsVenueDetails']),
            Paragraph(f"Statement No: {statement_number}", styles['InsNumber'])
        ],
        [
            Paragraph(f"Tel: {venue_phone}<br/>Email: {venue_email}", styles['InsVenueDetails']),
            Paragraph(f"Date: {format_uk_date(statement_date)}", styles['InsRightAlign'])
        ]
    ]

    header_table = Table(header_data, colWidths=[100*mm, 70*mm])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 15*mm))

    # Claimant Details
    horse_line = f"<br/>Horse: {horse_name}" if horse_name else ""
    details_data = [
        [
            Paragraph("Claimant Details:", styles['InsSectionHeader']),
            Paragraph("Claim Period:", styles['InsSectionHeader'])
        ],
        [
            Paragraph(f"{customer_name}<br/>{customer_email}{horse_line}", styles['InsCustomerDetails']),
            Paragraph(
                f"From: {format_uk_date(period_start)}<br/>"
                f"To: {format_uk_date(period_end)}",
                styles['InsCustomerDetails']
            )
        ]
    ]

    details_table = Table(details_data, colWidths=[85*mm, 85*mm])
    details_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(details_table)
    elements.append(Spacer(1, 10*mm))

    # Certification statement
    elements.append(Paragraph(
        "This statement certifies that the following rehabilitation and veterinary-related services "
        "were provided during the period specified above:",
        styles['InsNotes']
    ))
    elements.append(Spacer(1, 5*mm))

    # Line items table
    items_header = ['Date', 'Service', 'Horse', 'Description', 'Amount']
    items_data = [items_header]

    for item in line_items:
        items_data.append([
            format_uk_date(item.get('service_date')),
            item.get('service_name', '')[:20],
            item.get('horse_name', '')[:15],
            item.get('description', '')[:40],
            format_currency(item.get('amount', Decimal('0')))
        ])

    items_table = Table(items_data, colWidths=[22*mm, 35*mm, 28*mm, 60*mm, 25*mm])
    items_table.setStyle(TableStyle([
        # Header row
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#276749')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),

        # Data rows
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ('TOPPADDING', (0, 1), (-1, -1), 5),

        # Alignment
        ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),

        # Grid
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),

        # Alternating row colors
        *[('BACKGROUND', (0, i), (-1, i), colors.HexColor('#f0fff4'))
          for i in range(2, len(items_data), 2)]
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 5*mm))

    # Total section
    total_data = [
        ['', '', '', 'Total Claimed:', format_currency(total_amount)]
    ]
    total_table = Table(total_data, colWidths=[22*mm, 35*mm, 28*mm, 60*mm, 25*mm])
    total_table.setStyle(TableStyle([
        ('ALIGN', (-2, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (-2, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (-2, 0), (-1, -1), 11),
        ('TEXTCOLOR', (-2, 0), (-1, -1), colors.HexColor('#276749')),
        ('BACKGROUND', (-2, 0), (-1, 0), colors.HexColor('#c6f6d5')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(total_table)
    elements.append(Spacer(1, 15*mm))

    # Notes section
    if notes:
        elements.append(Paragraph("Notes:", styles['InsSectionHeader']))
        elements.append(Paragraph(notes, styles['InsNotes']))
        elements.append(Spacer(1, 5*mm))

    # Footer / certification
    elements.append(Spacer(1, 10*mm))
    footer_text = (
        "<b>Certification:</b><br/>"
        "I hereby certify that the above services were provided as described and the amounts shown "
        "are accurate. This statement is provided for insurance claim purposes.<br/><br/>"
        f"<b>{venue_name}</b><br/>"
        f"Date: {format_uk_date(statement_date)}"
    )
    elements.append(Paragraph(footer_text, styles['InsNotes']))

    # Build PDF
    doc.build(elements)

    pdf_bytes = buffer.getvalue()
    buffer.close()

    return pdf_bytes
