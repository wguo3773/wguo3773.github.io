# 1. Start an Original BOLD trial
library(BOLDx)
cfg <- bold_config(target=0.25, nmax=21, gamma=0.90, tau=0.50,
                   sensitivity=0.90, specificity=0.98, rho=0.80)
start <- plan_bold(history=NULL, ndoses=4, method="bold", config=cfg)
print(start$dose_recommendation)
print(start$ready)

# 2. Enter a completed cohort and recommend the next dose
history <- data.frame(dose=c(1L,1L,1L), dlt=c(0L,0L,0L),
                      followup=c(3,3,3))
print(history)
original <- plan_bold(history, ndoses=4, current_dose=1,
                      method="bold", config=cfg)
print(original$dose_recommendation)
print(original$dose_recommendation$dose_summary, digits=4)

# 3. Add predictions and plan intervention for the incoming cohort
prediction_plan <- plan_bold(history, ndoses=4, current_dose=1,
  method="prediction", config=cfg,
  prediction=c(1L,0L,0L), eligible=c(TRUE,TRUE,TRUE))
print(prediction_plan$dose_recommendation)
print(prediction_plan$intervention_plan)
print(prediction_plan$ready)

# 4. Record an actual intervention failure
failure_history <- transform(history, prediction=c(1L,0L,0L),
  eligible=TRUE, intervened=c(TRUE,FALSE,FALSE), dlt=c(1L,0L,0L))
print(failure_history)
failure <- plan_bold(failure_history, 4, 1, method="prediction", config=cfg,
                    prediction=c(0L,0L,0L))
print(failure$dose_recommendation)
print(failure$dose_recommendation$patient_status)

# 5. Update delayed outcomes in TITE-BOLD
pending <- data.frame(dose=c(1L,1L,1L), dlt=c(0L,0L,0L),
                      followup=c(3,3,1.5))
print(pending)
print(recommend_dose(pending, 4, 1, method="bold", config=cfg))
tite <- plan_bold(pending, 4, 1, method="tite", config=cfg)
print(tite$dose_recommendation)
print(tite$dose_recommendation$patient_status)
pending$followup[3] <- 3
print(recommend_dose(pending, 4, 1, method="tite", config=cfg))

# 6. Combine prediction, prevention, and delayed outcomes
combined_history <- transform(pending, prediction=c(1L,0L,0L),
  eligible=TRUE, intervened=c(TRUE,FALSE,FALSE))
combined_history$followup <- c(1.5,3,3)
waiting <- plan_bold(combined_history, 4, 1, method="combined", config=cfg,
                     prediction=c(1L,0L,0L))
print(waiting$dose_recommendation)
print(waiting$intervention_plan)
combined_history$followup[1] <- 3
combined <- plan_bold(combined_history, 4, 1, method="combined", config=cfg,
                      prediction=c(1L,0L,0L))
print(combined$dose_recommendation)
print(combined$dose_recommendation$patient_status)
print(combined$intervention_plan)

# 7. Inspect the weighted Beta branches
mixture <- beta_mixture(a=0.75, b=2.25, q=c(1,1),
  labels=c(1L,1L), sensitivity=0.90, specificity=0.98, target=0.25)
print(mixture$components, digits=6)
print(c(mean=mixture$mean, overdose_probability=mixture$overdose_probability),
      digits=6)

# 8. Simulate one specified scenario with all six designs
methods <- c("bold","prediction","tite","combined","boin","tite_boin")
single <- simulate_bold(p.true=c(0.05,0.15,0.30,0.45,0.60),
  config=bold_config(target=0.30, nmax=21, gamma=0.90, tau=0.50,
    sensitivity=0.90, specificity=0.98, rho=0.80),
  method=methods, nsim=1000, seed=42, mtd=3)
print(single$summary, digits=5, row.names=FALSE)
print(single$mcse, digits=4, row.names=FALSE)

# 9. Generate 50 scenarios and run 1000 trials per design
panel <- simulate_random_scenarios(ndoses=4, mtd=2,
  lower_gap=0.10, upper_gap=0.15, risk_bounds=c(0.01,0.70),
  nscenarios=50, config=cfg, method=methods, nsim=1000, seed=42)
print(head(panel$scenarios, 6), digits=5)
print(panel$aggregate, digits=5, row.names=FALSE)

# 10. Draw spaghetti comparisons and inspect the audit table
comparison <- plot_spaghetti(panel, method="combined", comparator="tite_boin",
                              metric="accuracy_pct", relative_gap=0.10,
                              target=0.25)
print(head(comparison, 6), digits=5)
print(table(comparison$direction))

# 11. Include all-too-toxic cases and both upper gaps
boundary <- simulate_random_scenarios(ndoses=4, mtd=c(0,2),
  upper_gap=c(0.15,0.20), lower_gap=0.10, nscenarios=5,
  config=cfg, method=c("bold","combined","tite_boin"),
  nsim=1000, seed=42)
print(boundary$settings[c(1,6,11,16),], row.names=FALSE)
print(boundary$aggregate[c("method","mtd","upper_gap","n_scenarios",
                           "accuracy_pct","accuracy_sd","actual_dlts")],
      digits=5, row.names=FALSE)
