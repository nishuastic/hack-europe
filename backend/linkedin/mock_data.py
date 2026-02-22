"""Generate mock LinkedIn Connections CSV for testing the import flow."""

import csv
import io

# Common demo companies that likely match leads in the system
_MATCHING_CONNECTIONS = [
    ("Sarah", "Johnson", "sarah.johnson@stripe.com", "Stripe", "Head of Partnerships", "15 Jan 2023"),
    ("Michael", "Chen", "m.chen@plaid.com", "Plaid", "VP Engineering", "03 Mar 2022"),
    ("Emma", "Williams", "emma.w@revolut.com", "Revolut", "Product Manager", "22 Aug 2023"),
    ("James", "Brown", "jbrown@wise.com", "Wise", "Director of Sales", "11 Nov 2021"),
    ("Lisa", "Garcia", "lisa.g@klarna.com", "Klarna", "Senior Account Executive", "05 Jun 2022"),
    ("David", "Miller", "dmiller@adyen.com", "Adyen", "CTO", "19 Feb 2023"),
    ("Anna", "Taylor", "ataylor@checkout.com", "Checkout.com", "VP Product", "30 Sep 2022"),
    ("Robert", "Anderson", "r.anderson@n26.com", "N26", "Head of Growth", "14 Jul 2023"),
    ("Sophie", "Martinez", "smartinez@monzo.com", "Monzo", "Engineering Manager", "08 Apr 2022"),
    ("Thomas", "Lee", "tlee@sumup.com", "SumUp", "Director of Strategy", "25 Dec 2021"),
]

# Unrelated connections to make it realistic
_OTHER_CONNECTIONS = [
    ("Alex", "Kowalski", "alex.k@gmail.com", "Freelance", "UX Designer", "01 Jan 2024"),
    ("Maria", "Novak", "", "University of Amsterdam", "Professor", "17 May 2020"),
    ("Chris", "O'Brien", "cobrien@accenture.com", "Accenture", "Senior Consultant", "09 Oct 2021"),
    ("Yuki", "Tanaka", "ytanaka@toyota.co.jp", "Toyota", "Innovation Lead", "20 Jun 2023"),
    ("Priya", "Sharma", "priya@techstars.com", "Techstars", "Program Director", "12 Aug 2022"),
    ("Lucas", "Dubois", "", "Self-Employed", "Startup Founder", "28 Feb 2023"),
    ("Nina", "Petrova", "nina.p@mckinsey.com", "McKinsey & Company", "Associate Partner", "15 Apr 2021"),
    ("Omar", "Hassan", "ohassan@aws.com", "Amazon Web Services", "Solutions Architect", "07 Nov 2022"),
    ("Elena", "Rossi", "erossi@google.com", "Google", "Product Lead", "23 Sep 2023"),
    ("Felix", "Weber", "fweber@sap.com", "SAP", "VP Sales EMEA", "11 Mar 2022"),
]


def generate_mock_csv_text() -> str:
    """Generate LinkedIn-style Connections CSV content."""
    output = io.StringIO()
    writer = csv.writer(output)
    # LinkedIn CSV has some notes before the header
    writer.writerow(["Notes:"])
    writer.writerow([])
    writer.writerow(["First Name", "Last Name", "Email Address", "Company", "Position", "Connected On"])

    for row in _MATCHING_CONNECTIONS + _OTHER_CONNECTIONS:
        writer.writerow(row)

    return output.getvalue()


def generate_mock_csv_file(path: str = "mock_linkedin_connections.csv") -> str:
    """Write mock CSV to a file. Returns the file path."""
    content = generate_mock_csv_text()
    with open(path, "w", newline="") as f:
        f.write(content)
    return path


if __name__ == "__main__":
    filepath = generate_mock_csv_file()
    print(f"Mock LinkedIn CSV generated: {filepath}")
