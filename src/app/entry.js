'use strict';
import $ from 'jquery';
import 'bootstrap/dist/js/bootstrap.min.js';
import 'bootstrap/dist/css/bootstrap.min.css';

$('.availability-toggle-button').each((i, e) => {
  const button = $(e);
  button.on('click', () => {
    const scheduleId = button.data('schedule-id');
    const userId = button.data('user-id');
    const candidateId = button.data('candidate-id');
    const availability = parseInt(button.data('availability'));
    const nextAvailability = (availability + 1) % 3;
    fetch(
      `/schedules/${scheduleId}/users/${userId}/candidates/${candidateId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availability: nextAvailability }),
      },
    )
      .then((response) => response.json())
      .then((data) => {
        button.data('availability', data.availability);
        const availabilityLabels = ['❓', '🔥 行きたい', '⭐ 行ったことある'];
        button.text(availabilityLabels[data.availability]);
        
        const buttonStyles = ['btn-info', 'btn-primary', 'btn-success'];
        button.removeClass('btn-info btn-primary btn-success btn-danger btn-secondary'); // 念のため古い色もリセット対象に含めておく
        button.addClass(buttonStyles[data.availability]);
      });
  });
});

const buttonSelfComment = $('#self-comment-button');
buttonSelfComment.on('click', () => {
  const scheduleId = buttonSelfComment.data('schedule-id');
  const userId = buttonSelfComment.data('user-id');
  const comment = prompt('一口メモや食べたいメニューを入力してください。');
  if (comment) {
    fetch(`/schedules/${scheduleId}/users/${userId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: comment }),
    })
      .then((response) => response.json())
      .then((data) => {
        $('#self-comment').text(data.comment);
      });
  }
});