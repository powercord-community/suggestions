import core from '@actions/core'
import github from '@actions/github'

const token = core.getInput('gh-token')
const octokit = github.getOctokit(token)

const templateRejectionMessage = `Hello,

Thanks for taking the time to submit a suggestion. Unfortunately, your suggestion was rejected for the following reason:

$reason

<sub>This is an automated reply. If you feel like there is an error, or if you have questions, please reach us on our [Discord server](https://discord.gg/gs4ZMbBfCh).</sub>`
const PLACEHOLDER_DESCRIPTION = 'A clear and concise description of what the plugin would do.\nDon\'t get too specific, that\'s for the next part.'
const PLACEHOLDER_INFO = 'You can here put more technical information, or get more specific.\nFeel free to also add context, mockups or anything else here.'

const issueQuery = {
  owner: github.context.issue.owner,
  repo: github.context.issue.repo,
  issue_number: github.context.issue.number,
}

function reject (reason) {
  const message = templateRejectionMessage.replace('$reason', reason)
    Promise.resolve()
      .then(() => octokit.issues.createComment({ ...issueQuery, body: message }))
      .then(() => octokit.issues.update({ ...issueQuery,  labels: [ 'declined: invalid' ], state: 'closed' }))
      .then(() => octokit.issues.lock(issueQuery))
}

octokit.issues.get(issueQuery).then(issue => {
  if (issue.data.state === 'closed') return

  let body = (issue.data.body || '').replace(/\r/g, '')
  let done = []

  // If the issue doesn't contain a description/separator, yell at people
  const descMatch = body.match(/^### Description(?:\n *)+((?:.|\n)+?)(?:###(?:.|\n)+?)*-{4,}/m)
  if (!descMatch || !descMatch[1].trim()) {
    reject('Your suggestion does not follow the provided template. Please open a new issue, and make sure to follow the template.')
    return
  }

  // If the template hasn't been filled, just close it
  if (descMatch[1].trim() === PLACEHOLDER_DESCRIPTION) {
    reject('You did not fill the template. Please open a new issue, and make sure to fill the template appropriately.')
    return
  }

  // If the "More info" section is left empty, silently remove it
  const moreMatch = body.match(/^### More info\n((?:.|\n)+?)-{4,}/m)
  if (moreMatch && (!moreMatch[1].trim() || moreMatch[1].trim() === PLACEHOLDER_INFO)) {
    body = body.replace(/(?:\n *)+### More info\n(?:(?:.|\n)+?)(-{4,})/, '\n\n$1')
    done.push('removed empty "more info" section')
  }

  // If the separator is misplaced, silently fix it
  if (!body.match(/(?:\n *){2,}-{4,}/)) {
    body = body.replace(/(?:\n *)+(-{4,})/, '\n\n$1')
    done.push('added spacing before separator')
  }

  if (done.length) {
    body += `\n\n<!-- Automated actions performed: ${done.join(', ')} -- ${new Date().toUTCString()} -->`
    octokit.issues.update({ ...issueQuery, body: body })
  }
})
