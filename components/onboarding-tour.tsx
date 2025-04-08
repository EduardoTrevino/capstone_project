// components/onboarding-tour.tsx
"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"

interface OnboardingTourProps {
  username: string
  onFinish: () => void
  initialStep?: number
  // Add a prop to signal opening the goal dialog AFTER finishing the tour
  onFinishAndOpenGoalDialog?: () => void
}

// Keep config outside
export const tourStepsConfig = [
    // ... (same steps 0-4 as before) ...
    { // Step 0
        target: "#revenue",
        content: "Here in the Business section, you can track your money matters—Revenue & Profit—to see how well your drone-leasing model is performing.",
        page: "/dashboard",
    },
    { // Step 1
        target: "#workforce",
        content: "You'll also keep an eye on Workforce Management. Make sure your team is well-trained and happy, so your service runs smoothly.",
        page: "/dashboard",
    },
    { // Step 2
        target: "#satisfaction",
        content: "Next, check Customer Satisfaction graphs. Satisfied farmers mean repeat customers and great word-of-mouth!",
        page: "/dashboard",
    },
    { // Step 3 - Navigation Prompt
        target: ".fixed.bottom-0", // Target the nav bar itself (might need more specific selector if multiple fixed bottom elements exist)
        content: "Great! Now let's head over to your Goals page (the Home icon) to set your first learning objective.",
        page: "/dashboard",
        action: "navigate",
        destination: "/dashboard/goal", // Ensure destination is correct
    },
    { // Step 4 - Final step on Goals page
        target: "#goal-section-trigger", // ID on the goal page
        content: "This is your Goals area. Click here to view them. Now that you understand the basics, let's begin by setting your first learning goal!",
        page: "/dashboard/goal",
        isFinalClickStep: true,
    },
];

export function OnboardingTour({
    username,
    onFinish,
    initialStep = 0,
    onFinishAndOpenGoalDialog, // Receive the new prop
}: OnboardingTourProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [step, setStep] = useState(initialStep);
    const [isVisible, setIsVisible] = useState(true);
    const [spotlightPosition, setSpotlightPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    const tooltipRef = useRef<HTMLDivElement>(null);
    const targetElementRef = useRef<HTMLElement | null>(null); // Ref to store the target element

    // Memoize derived state based only on step and pathname (which are stable)
    const currentStepConfig = tourStepsConfig[step];
    const shouldRenderUI = currentStepConfig?.page === pathname && isVisible;

    // --- Finish Tour Logic ---
    const finishTour = useCallback(async (openDialog: boolean = false) => {
        setIsVisible(false);
        console.log("Attempting to mark tour as finished for user:", username);
        if (!username) {
            console.error("Cannot finish tour: Username is missing.");
            onFinish(); // Call parent onFinish anyway
            if (openDialog && onFinishAndOpenGoalDialog) onFinishAndOpenGoalDialog(); // Maybe open dialog
            return;
        }
        try {
            const { error } = await supabase
                .from("users")
                .update({ dashboard_tour_done: true })
                .eq("name", username);

            if (error) {
                console.error("Error marking tour done in DB:", error.message);
            } else {
                console.log("Tour marked as done in DB for user:", username);
            }
        } catch (dbError) {
             console.error("Exception marking tour done in DB:", dbError);
        } finally {
            onFinish(); // Call original onFinish
            // If this was triggered by the final click, call the specific callback
            if (openDialog && onFinishAndOpenGoalDialog) {
                 console.log("Calling onFinishAndOpenGoalDialog");
                 onFinishAndOpenGoalDialog();
            }
        }
    }, [onFinish, username, onFinishAndOpenGoalDialog]); // Add new prop to dependencies


    // --- Update Positions Logic ---
    // This depends on step, pathname, isVisible. tourStepsConfig is constant.
    const updatePositions = useCallback(() => {
        const currentConfig = tourStepsConfig[step];
        // Check if the step is for the current page before proceeding
        if (!currentConfig || currentConfig.page !== pathname || !isVisible) {
            targetElementRef.current = null; // Clear target ref if not on correct page/step
            return;
        }

        const targetElement = document.querySelector(currentConfig.target) as HTMLElement;
        targetElementRef.current = targetElement; // Store target element

        if (!targetElement) {
            console.warn("Tour target element not found:", currentConfig.target, "on page", pathname, "at step", step);
             setIsVisible(false); // Hide tour if target missing
            return;
        }

        const rect = targetElement.getBoundingClientRect();
        const padding = 10;

        // Use functional updates for setState if depending on previous state (optional here, but good practice)
        setSpotlightPosition({
            top: rect.top - padding + window.scrollY,
            left: rect.left - padding + window.scrollX,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2,
        });

        const tooltipHeight = tooltipRef.current?.offsetHeight || 200;
        let tooltipTop = rect.top + rect.height + padding + 20 + window.scrollY;
        if (tooltipTop + tooltipHeight > window.innerHeight + window.scrollY - 50) {
            tooltipTop = Math.max(20 + window.scrollY, rect.top - tooltipHeight - 20 + window.scrollY);
        }
        let tooltipLeft = Math.max(20 + window.scrollX, rect.left + rect.width / 2 - 150 + window.scrollX);
        const tooltipWidth = 300;
        if (tooltipLeft + tooltipWidth > window.innerWidth + window.scrollX - 20) {
            tooltipLeft = window.innerWidth + window.scrollX - tooltipWidth - 20;
        }
        setTooltipPosition({ top: tooltipTop, left: tooltipLeft });

        // Scroll only if needed
        targetElement.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });

    }, [step, pathname, isVisible]); // Dependencies are stable primitives or memoized config

    // --- Main Effect for Position Update and Listeners ---
    useEffect(() => {
        updatePositions(); // Initial position update for the current step/page

        // Define listener for the final click step
        const handleFinalClick = (event: MouseEvent) => {
            console.log("Final step target clicked via tour listener!");
            event.stopPropagation(); // Prevent page's onClick if needed (we want both here actually, page opens dialog)
            event.preventDefault(); // Prevent default actions if any
             finishTour(true); // Finish the tour AND signal to open the dialog
        };

        const currentConfig = tourStepsConfig[step];
        const targetElement = targetElementRef.current; // Get target from ref

        // Add/Remove listener logic ONLY if it's the final step and the target exists
        if (currentConfig?.isFinalClickStep && targetElement && currentConfig.page === pathname) {
             console.log("Attaching final click listener to:", targetElement);
             // Ensure target is clickable THROUGH the overlay hole
             targetElement.style.pointerEvents = "auto";
             targetElement.addEventListener("click", handleFinalClick, { capture: true }); // Use capture to ensure it runs

            // Cleanup function for this specific effect iteration
             return () => {
                 console.log("Cleaning up final click listener from:", targetElement);
                if (targetElement) {
                    targetElement.removeEventListener("click", handleFinalClick, { capture: true });
                    targetElement.style.pointerEvents = ""; // Reset pointer events
                }
                 window.removeEventListener("resize", updatePositions); // Also clean up resize here
            };
        } else if (targetElement) {
            // Ensure non-final targets are NOT clickable through the hole
            targetElement.style.pointerEvents = "none";
        }

         // Add resize listener regardless of final step (if UI is visible)
         if (shouldRenderUI) {
             window.addEventListener("resize", updatePositions);
         }

        // General cleanup for resize and resetting pointer events if element existed
        return () => {
            if (targetElement && !currentConfig?.isFinalClickStep) { // Reset only if not final step
                targetElement.style.pointerEvents = "";
            }
            if (shouldRenderUI) {
                 window.removeEventListener("resize", updatePositions);
            }
        };
        // This effect runs when step, pathname, or updatePositions changes.
        // updatePositions only changes if step, pathname, or isVisible changes.
    }, [step, pathname, updatePositions, finishTour, shouldRenderUI]); // Add shouldRenderUI and finishTour

    // --- Effect for Navigation ---
    useEffect(() => {
        const currentConfig = tourStepsConfig[step];
        if (currentConfig?.action === 'navigate' && currentConfig.page === pathname) {
            localStorage.setItem('onboardingStep', (step + 1).toString());
            router.push(currentConfig.destination);
        }
    }, [step, pathname, router]); // Keep dependencies minimal


    // --- Event Handlers ---
    const handleNext = () => {
        if (step < tourStepsConfig.length - 1) {
            setStep(step + 1);
        } else {
            finishTour(false); // Finish without opening dialog if last step wasn't the click one
        }
    };

    const handleSkip = () => {
        finishTour(false); // Skip without opening dialog
    };

    // --- Render Logic ---
    if (!shouldRenderUI) {
        return null; // Don't render if not visible or not on the correct page
    }

    const currentDisplayStep = tourStepsConfig[step]; // Guaranteed to be correct config for current step

    return (
        <div className="fixed inset-0 z-[100] pointer-events-none">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/70 pointer-events-auto" onClick={handleSkip} />

            {/* Spotlight */}
            <motion.div
                // ... motion props ...
                initial={false}
                animate={{
                    top: spotlightPosition.top,
                    left: spotlightPosition.left,
                    width: spotlightPosition.width,
                    height: spotlightPosition.height,
                    opacity: shouldRenderUI ? 1 : 0, // Fade out if not rendering UI
                }}
                transition={{ type: "spring", stiffness: 500, damping: 30, duration: 0.3 }}
                className="absolute rounded-lg"
                style={{
                    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.75)",
                    // Hole allows clicks ONLY if it's the final step
                    pointerEvents: currentDisplayStep.isFinalClickStep ? "none" : "auto",
                }}
            />

            {/* Tooltip */}
            <AnimatePresence mode="wait">
                <motion.div
                    // ... motion props ...
                    key={step}
                    ref={tooltipRef}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="absolute pointer-events-auto"
                    style={{
                        top: tooltipPosition.top,
                        left: tooltipPosition.left,
                        width: "300px",
                        maxWidth: "calc(100vw - 40px)",
                        zIndex: 101,
                    }}
                >
                    <Card className="shadow-lg border-green-500 border-2 bg-white">
                        <CardContent className="pt-6">
                            <p className="text-sm text-gray-600 mb-2">
                                Step {step + 1} of {tourStepsConfig.length}
                            </p>
                            <p>{currentDisplayStep.content}</p>
                        </CardContent>
                        <CardFooter className="flex justify-between">
                            <Button variant="outline" onClick={handleSkip} size="sm">
                                Skip Tour
                            </Button>
                            {/* Button logic: Disable on final click step */}
                            {!currentDisplayStep.isFinalClickStep ? (
                                <Button onClick={handleNext} size="sm">
                                    {currentDisplayStep.action === 'navigate' ? "Next (Go to Goals)" : "Next"}
                                </Button>
                            ) : (
                                <Button size="sm" disabled>
                                    Click Goal Area
                                </Button>
                            )}
                        </CardFooter>
                    </Card>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}