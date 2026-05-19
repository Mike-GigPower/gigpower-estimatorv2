"use client";

import Image from "next/image";
import styles from "../request-estimate.module.css";

export default function RequestFormHero() {
  return (
    <>
      <div className={styles.hero}>
        <div className={styles.heroLogo}>
          <Image
            src="/brand/gigpower-logo.png"
            alt="GigPower"
            width={300}
            height={100}
            style={{ width: "auto", height: 60, objectFit: "contain" }}
            priority
          />
        </div>
        <h1>Request an estimate</h1>
        <p className={styles.heroSub}>
          Tell us about your event and the crew you need. We&apos;ll send a
          costed estimate to your inbox — usually within one business day.
        </p>
      </div>

      <div className={styles.nextSteps}>
        <div className={styles.nextStep}>
          <div className={styles.stepNum}>1</div>
          <div className={styles.stepText}>
            <strong>Fill in the form</strong>
            <span>Around 3 minutes for most events.</span>
          </div>
        </div>
        <div className={styles.nextStep}>
          <div className={styles.stepNum}>2</div>
          <div className={styles.stepText}>
            <strong>Verify your email</strong>
            <span>We&apos;ll send a 6-digit code to confirm.</span>
          </div>
        </div>
        <div className={styles.nextStep}>
          <div className={styles.stepNum}>3</div>
          <div className={styles.stepText}>
            <strong>Get your estimate</strong>
            <span>Typically within 1 business day.</span>
          </div>
        </div>
      </div>
    </>
  );
}
