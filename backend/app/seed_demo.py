"""
Seed example providers for conference demo and development.

Run from the backend/ directory after applying migrations and seeding
credentials + admin (python -m app.seed):

    python -m app.seed_demo

Creates 4 example providers with locations that have hardcoded lat/lng
coordinates (looked up from Nominatim once, baked in here so the seed
is deterministic and doesn't require network access).

Profiles are based on real Oregon dental hygienist archetypes — EPDH
mobile provider, diagnostics-focused RDH, anxiety-aware prevention
specialist, and bilingual community health provider. Display names are
prefixed with [Example] so conference attendees know these aren't real
signups. Each provider is tagged "example-profile" for easy filtering
in the search frontend.

Safe to re-run — skips providers whose email already exists.

Why a separate file from seed.py:
  seed.py = structural data (credentials, admin) — needed in every env.
  seed_demo.py = example profiles (showcase) — dev/staging only.
"""

import asyncio
import uuid

from app.config import settings
from app.database import async_session, engine
from app.models.enums import (
    Availability,
    ProviderStatus,
    ProviderType,
    UserRole,
)
from app.models.provider import Provider, ProviderCredential, ProviderLocation
from app.models.user import User
from app.services.auth_service import hash_password, get_user_by_email


# ── Example profiles ─────────────────────────────────────────────
#
# Ported from oral-health-providers/SamplePractitioners.cs.
# Names are pseudonyms inspired by real Oregon community leaders.
# Coordinates from Nominatim, hardcoded to 6 decimals.

DEMO_PROVIDERS = [
    # ── Jenna Morris (inspired by Kim Perlot) ────────────────────
    # EPDH + Dental Therapist, mobile unit in rural Central Oregon.
    # Showcases: traveling provider, is_public=False home base,
    # max_travel_miles, multi-credential.
    {
        "email": "jenna.morris@example.com",
        "password": "DemoPass123!",
        "display_name": "[Example] Jenna Morris",
        "provider_type": ProviderType.DENTAL_HYGIENIST,
        "title_line": "EPDH, DT, RDH — Mobile Dental Care, Central Oregon",
        "bio": (
            "I bring preventive and restorative care directly to rural "
            "Central Oregon through my mobile dental unit. As an Expanded "
            "Practice Hygienist and Dental Therapist, I can see patients "
            "without requiring a trip to a traditional dental office. My "
            "approach focuses on minimally invasive care and practical "
            "education — helping you stay healthy instead of waiting for "
            "problems to worsen. This works well for rural families, "
            "seniors, and anyone who has had difficulty accessing "
            "traditional dental offices. I'd be glad to talk about "
            "whether mobile care might work for you."
        ),
        "phone": "(541) 555-0101",
        "public_email": "jenna.morris@example.com",
        "services": [
            "preventive care",
            "restorative care",
            "sealants",
            "fluoride treatments",
            "oral health education",
        ],
        "specialties": ["pediatric", "geriatric", "restorative"],
        "populations_served": ["rural families", "seniors", "children"],
        "insurance_accepted": ["OHP", "Delta Dental", "Cash/Sliding Scale"],
        "languages": ["English"],
        "tags": ["example-profile", "mobile provider", "rural access", "minimally invasive"],
        "availability": Availability.MOBILE,
        "accepting_new_patients": True,
        "max_travel_miles": 50,
        "credentials": ["RDH", "EPDH", "DT"],
        "locations": [
            {
                "label": "Home Base — Central Oregon",
                "city": "Bend",
                "state": "OR",
                "zip_code": "97701",
                "latitude": 44.058200,
                "longitude": -121.315300,
                "is_primary": True,
                "is_public": False,  # mobile provider — home base private (ADR-013)
            },
        ],
    },
    # ── Ryan Ashworth (inspired by Stephen Quimby) ───────────────
    # RDH with advanced diagnostics, two office locations.
    # Showcases: multi-location, salivary testing / oral cancer
    # screening niche, prevention + periodontal focus.
    {
        "email": "ryan.ashworth@example.com",
        "password": "DemoPass123!",
        "display_name": "[Example] Ryan Ashworth",
        "provider_type": ProviderType.DENTAL_HYGIENIST,
        "title_line": "RDH, LAP — Preventive & Periodontal Care",
        "bio": (
            "I provide preventive and periodontal care using advanced "
            "diagnostics to identify risk early and guide long-term oral "
            "health. With tools like salivary testing and oral cancer "
            "screening, I help patients understand the connection between "
            "their mouth and their body. I take time to explain findings "
            "and options so you're never left guessing. This is a good "
            "fit if you value prevention, clear communication, and "
            "understanding the mouth-body connection. Reach out if you'd "
            "like to learn more."
        ),
        "phone": "(503) 555-0102",
        "public_email": "ryan.ashworth@example.com",
        "services": [
            "preventive care",
            "periodontal care",
            "salivary diagnostics",
            "oral cancer screening",
        ],
        "specialties": ["periodontal", "diagnostics"],
        "populations_served": ["adults"],
        "insurance_accepted": ["Delta Dental", "Cigna", "Most major insurance"],
        "languages": ["English"],
        "tags": ["example-profile", "diagnostics", "salivary testing", "oral cancer screening"],
        "availability": Availability.IN_PERSON,
        "accepting_new_patients": True,
        "max_travel_miles": None,
        "credentials": ["RDH", "LAP"],
        "locations": [
            {
                "label": "Main Office",
                "practice_name": "Pacific Dental Services",
                "city": "Portland",
                "state": "OR",
                "zip_code": "97201",
                "latitude": 45.515200,
                "longitude": -122.678400,
                "is_primary": True,
                "is_public": True,
            },
            {
                "label": "East Side Office",
                "city": "Happy Valley",
                "state": "OR",
                "zip_code": "97086",
                "latitude": 45.446800,
                "longitude": -122.530100,
                "is_primary": False,
                "is_public": True,
            },
        ],
    },
    # ── Dana Henshaw (inspired by Karan Bershaw) ─────────────────
    # UCSF-trained, anxiety-aware, evidence-based caries management.
    # Showcases: prevention-first philosophy, anxiety-friendly tag,
    # single office location.
    {
        "email": "dana.henshaw@example.com",
        "password": "DemoPass123!",
        "display_name": "[Example] Dana Henshaw",
        "provider_type": ProviderType.DENTAL_HYGIENIST,
        "title_line": "RDH, BSDH — Prevention-First & Anxiety-Aware Care",
        "bio": (
            "Dental disease is a chronic, manageable condition — not a "
            "series of emergencies. I help patients through prevention, "
            "risk assessment, and evidence-based caries management rather "
            "than waiting for problems and then fixing them. With "
            "advanced training from UCSF, I focus on reducing disease "
            "progression while helping you feel informed and in control. "
            "Anxiety-aware care is a core part of my practice. I often "
            "work with adults who've had negative past dental experiences "
            "or who want a thoughtful, prevention-first approach. Feel "
            "free to reach out — no commitment needed."
        ),
        "phone": "(503) 555-0103",
        "public_email": "dana.henshaw@example.com",
        "services": [
            "preventive care",
            "risk assessment",
            "caries management",
            "patient education",
        ],
        "specialties": ["preventive", "anxiety-friendly", "caries management"],
        "populations_served": ["adults"],
        "insurance_accepted": ["BlueCross", "Aetna", "PacificSource", "Cash"],
        "languages": ["English"],
        "tags": ["example-profile", "anxiety-friendly", "CAMBRA", "prevention-first"],
        "availability": Availability.IN_PERSON,
        "accepting_new_patients": True,
        "max_travel_miles": None,
        "credentials": ["RDH", "BSDH"],
        "locations": [
            {
                "label": "Main Office",
                "city": "Portland",
                "state": "OR",
                "zip_code": "97205",
                "latitude": 45.515200,
                "longitude": -122.678400,
                "is_primary": True,
                "is_public": True,
            },
        ],
    },
    # ── Elena Vega ───────────────────────────────────────────────
    # Bilingual EPDH in community health + school-based settings.
    # Showcases: Spanish-language care, two public community
    # locations, RFE credential, OHP/Medicaid/sliding scale.
    {
        "email": "elena.vega@example.com",
        "password": "DemoPass123!",
        "display_name": "[Example] Elena Vega",
        "provider_type": ProviderType.DENTAL_HYGIENIST,
        "title_line": "RDH, EPDH, RFE — Community & School-Based Care",
        "bio": (
            "¿Busca atención de salud oral que se sienta accesible y "
            "respetuosa? I provide preventive and restorative care in "
            "schools and community health settings, with care available "
            "in both English and Spanish. My approach centers on "
            "understanding your unique risk factors and creating a clear "
            "prevention plan. I'm trained to place fillings and sealants, "
            "often in a single visit, reducing the need for multiple "
            "appointments. This works well for children, families, and "
            "patients who prefer community-based or mobile services. "
            "Reach out if you have questions — I'm happy to talk."
        ),
        "phone": "(503) 555-0104",
        "public_email": "elena.vega@example.com",
        "services": [
            "preventive care",
            "sealants",
            "fillings",
            "fluoride treatments",
            "oral health education",
        ],
        "specialties": ["pediatric", "community health"],
        "populations_served": [
            "children",
            "families",
            "Spanish-speaking",
            "uninsured",
        ],
        "insurance_accepted": ["OHP", "Medicaid", "Sliding Scale", "Cash"],
        "languages": ["English", "Spanish"],
        "tags": ["example-profile", "school-based", "bilingual", "community health"],
        "availability": Availability.BOTH,
        "accepting_new_patients": True,
        "max_travel_miles": 30,
        "credentials": ["RDH", "EPDH", "RFE"],
        "locations": [
            {
                "label": "Community Health Center",
                "city": "Salem",
                "state": "OR",
                "zip_code": "97301",
                "latitude": 44.942900,
                "longitude": -123.035100,
                "is_primary": True,
                "is_public": True,
            },
            {
                "label": "School-Based Program",
                "city": "Woodburn",
                "state": "OR",
                "zip_code": "97071",
                "latitude": 45.143700,
                "longitude": -122.855400,
                "is_primary": False,
                "is_public": True,
            },
        ],
    },
]


# ── Seed logic ───────────────────────────────────────────────────


async def seed_demo_providers() -> None:
    """Create example providers, credentials, and locations.

    Skips any provider whose email already exists (safe to re-run).
    """
    async with async_session() as session:
        for pdata in DEMO_PROVIDERS:
            existing = await get_user_by_email(session, pdata["email"])
            if existing:
                print(f"  Example provider {pdata['email']} already exists — skipping.")
                continue

            # User
            user = User(
                id=uuid.uuid4(),
                email=pdata["email"].lower(),
                password_hash=hash_password(pdata["password"]),
                role=UserRole.PROVIDER,
            )
            session.add(user)
            await session.flush()

            # Provider
            # Strip [Example] prefix for the slug so URLs read naturally
            clean_name = pdata["display_name"].replace("[Example] ", "")
            slug_base = clean_name.lower().replace(" ", "-")
            slug = f"{slug_base}-{uuid.uuid4().hex[:6]}"
            provider = Provider(
                id=uuid.uuid4(),
                user_id=user.id,
                display_name=pdata["display_name"],
                slug=slug,
                provider_type=pdata["provider_type"],
                title_line=pdata.get("title_line"),
                bio=pdata.get("bio"),
                phone=pdata.get("phone"),
                public_email=pdata.get("public_email"),
                services=pdata.get("services"),
                specialties=pdata.get("specialties"),
                populations_served=pdata.get("populations_served"),
                insurance_accepted=pdata.get("insurance_accepted"),
                languages=pdata.get("languages"),
                tags=pdata.get("tags"),
                availability=pdata.get("availability"),
                accepting_new_patients=pdata.get("accepting_new_patients", True),
                max_travel_miles=pdata.get("max_travel_miles"),
                status=ProviderStatus.APPROVED,
                auto_approved=True,
            )
            session.add(provider)
            await session.flush()

            # Credentials
            for code in pdata.get("credentials", []):
                cred = ProviderCredential(
                    provider_id=provider.id,
                    credential_code=code,
                )
                session.add(cred)

            # Locations (with hardcoded lat/lng — no Nominatim call needed)
            for i, loc_data in enumerate(pdata.get("locations", [])):
                location = ProviderLocation(
                    id=uuid.uuid4(),
                    provider_id=provider.id,
                    label=loc_data["label"],
                    practice_name=loc_data.get("practice_name"),
                    address_line1=loc_data.get("address_line1"),
                    city=loc_data.get("city"),
                    state=loc_data.get("state", "OR"),
                    zip_code=loc_data.get("zip_code"),
                    latitude=loc_data["latitude"],
                    longitude=loc_data["longitude"],
                    is_primary=loc_data.get("is_primary", i == 0),
                    is_public=loc_data.get("is_public", True),
                )
                session.add(location)

            await session.flush()
            print(f"  Created example provider: {pdata['display_name']} ({pdata['email']})")

        await session.commit()
        print("Example provider seed complete.")


async def main() -> None:
    try:
        await seed_demo_providers()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
