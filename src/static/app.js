document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  // Helper: escape HTML to avoid XSS when inserting participant text
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Helper: compute simple initials from an email or name
  function getInitials(identifier) {
    // Use part before @ or full string, then extract up to two characters
    const base = (identifier || "").split("@")[0];
    const parts = base.split(/[.\-_ ]+/).filter(Boolean);
    let first = parts[0] ? parts[0][0] : (base[0] || "");
    let second = parts[1] ? parts[1][0] : (base[1] || "");
    return (first + (second || "")).toUpperCase().slice(0, 2);
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Reset activity select options (keep placeholder)
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        activityCard.innerHTML = `
          <h4>${escapeHtml(name)}</h4>
          <p>${escapeHtml(details.description || "")}</p>
          <p><strong>Schedule:</strong> ${escapeHtml(details.schedule || "TBD")}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-section">
            <h5>Participants</h5>
            ${details.participants && details.participants.length > 0 ? `<ul class="participants-list">
              ${details.participants
                .map(p => `<li class="participant-item" data-email="${escapeHtml(p)}" data-activity="${escapeHtml(name)}"><span class="participant-badge">${escapeHtml(getInitials(p))}</span><span class="participant-email">${escapeHtml(p)}</span><button class="participant-delete" aria-label="Remove ${escapeHtml(p)}">✖</button></li>`)
                .join("")}
            </ul>` : `<p class="info">No participants yet</p>`}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Attach delegated click handler for delete buttons within this activity card
        activityCard.addEventListener("click", async (ev) => {
          const btn = ev.target.closest && ev.target.closest('.participant-delete');
          if (!btn) return;

          const li = btn.closest('.participant-item');
          if (!li) return;

          const participantEmail = li.dataset.email;
          const activityFor = li.dataset.activity;

          if (!participantEmail || !activityFor) return;

          if (!confirm(`Unregister ${participantEmail} from ${activityFor}?`)) return;

          try {
            const resp = await fetch(`/activities/${encodeURIComponent(activityFor)}/participants?email=${encodeURIComponent(participantEmail)}`, {
              method: "DELETE",
            });

            const result = await resp.json();

            if (resp.ok) {
              messageDiv.textContent = result.message;
              messageDiv.className = "message success";
              // Refresh activities to reflect removal
              fetchActivities();
            } else {
              messageDiv.textContent = result.detail || "Failed to unregister participant";
              messageDiv.className = "message error";
            }

            messageDiv.classList.remove("hidden");
            setTimeout(() => messageDiv.classList.add("hidden"), 5000);
          } catch (error) {
            messageDiv.textContent = "Failed to unregister. Please try again.";
            messageDiv.className = "message error";
            messageDiv.classList.remove("hidden");
            console.error("Error unregistering participant:", error);
          }
        });

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "message success";
        signupForm.reset();
        // Refresh activities so the newly registered participant appears
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "message error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "message error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();
});
