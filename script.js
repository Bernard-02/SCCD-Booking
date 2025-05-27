// Wait for the DOM to be fully loaded before running the animation
document.addEventListener('DOMContentLoaded', (event) => {
    // Select the inner text span
    const titleText = document.querySelector('.main-title .title-text');

    // Check if the element exists before animating
    if (titleText) {
        // Animate the title text
        gsap.fromTo(titleText,
            { y: '100%' }, // Initial state: translated down by 100% of its height
            {
                y: '0%',    // Final state: original position
                duration: 0.8, // Animation duration: 0.8 seconds
                ease: 'power1.out' // Easing function
            }
        );
    } else {
        console.error('Main title text element not found for animation.');
    }

    // Navigation link hover animation removed as requested.
});
