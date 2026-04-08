/**
 * About — what FindMyHygienist is, who it's for, and why it exists.
 *
 * Voice: warm, direct, patient-centered. Same register as the README
 * intro — "built so the people who take care of your teeth can show
 * you who they are."
 *
 * Audience at the conference: hygienists deciding whether to sign up.
 * Audience on the live site: patients figuring out what they need.
 * This page speaks to both.
 */

import { Link } from "react-router-dom";

function About() {
  return (
    <div className="about-page">
      <h1>About FindMyHygienist</h1>

      {/* ── What this is ── */}
      <section className="about-section">
        <p>
          FindMyHygienist is a directory for Oregon's dental hygienists —
          a place where the people who take care of your teeth can show you
          who they are, what they believe in, and how they practice.
        </p>
        <p>
          Patients search by location, by what matters to them — "my kids
          are afraid of the dentist," "Spanish-speaking," "accepts OHP" —
          and browse profiles to find care that makes them feel safe,
          respected, and seen. The kind of care hygienists strive to provide
          but patients don't always know how to find.
        </p>
        <p>
          Built in partnership with the{" "}
          <a
            href="https://www.odha.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Oregon Dental Hygienists' Association
          </a>{" "}
          (ODHA).
        </p>
      </section>

      {/* ── What a dental hygienist does ── */}
      <section className="about-section">
        <h2>What Does a Dental Hygienist Do?</h2>
        <p>
          Dental hygienists are licensed healthcare providers who specialize
          in preventive oral care. They clean teeth, take X-rays, apply
          sealants and fluoride, screen for oral cancer, and — in Oregon —
          can practice with an{" "}
          <strong>Expanded Practice Dental Hygienist (EPDH)</strong> permit
          that allows them to see patients independently, without a dentist
          on-site.
        </p>
        <p>
          That means a hygienist might be the provider you see most often
          for your regular care — and in underserved or rural areas, they
          may be the most accessible oral health professional available.
        </p>
      </section>

      {/* ── For providers ── */}
      <section className="about-section">
        <h2>For Providers</h2>
        <p>
          Create a profile, share your credentials, tell patients what
          you're about, and go live. Free to list through July 2026.
          $15/month after that. No contracts, no lock-in, no pay-to-rank.
        </p>
        <p>
          <Link to="/join" className="btn btn-primary">
            List With Us
          </Link>
        </p>
      </section>

      {/* ── FAQ stub ── */}
      <section className="about-section">
        <h2>Questions</h2>

        <div className="about-faq">
          <h3>Is FindMyHygienist only for dental hygienists?</h3>
          <p>
            It started there — Oregon's hygienists asked for a patient-facing
            directory where they could describe their approach to care directly 
            to patients and providers. That's why we're launching FindMyHygienist.org 
            with the Oregon Dental Hygienists' Association.
          </p>
          <p>
            But dentists, dental therapists, dental assistants, and other oral
            health providers can create a profile today. You'll show up in
            search results and have a full public listing. As we grow, we're
            building toward a broader home for patient-centered oral health
            professionals across Oregon.{" "}
            <Link to="/feedback">Tell us what you'd like to see.</Link>
          </p>

          <h3>Does it cost anything to search?</h3>
          <p>
            No. Search is always free for patients.
          </p>

          <h3>How do I report incorrect information on a listing?</h3>
          <p>
            Every provider profile has a "Report an issue" link at the
            bottom, or you can use the{" "}
            <Link to="/feedback">feedback form</Link> anytime.
          </p>

          <h3>Who built this?</h3>
          <p>
            FindMyHygienist was built by{" "}
            <a
              href="https://github.com/sooperD00"
              target="_blank"
              rel="noopener noreferrer"
            >
              N.&nbsp;L.&nbsp;Rowsey
            </a>
            {" "}in collaboration with the Oregon Dental Hygienists'
            Association.
          </p>
        </div>
      </section>
    </div>
  );
}

export default About;
