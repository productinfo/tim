const Ractive = require('ractive');
const { EVENT, bookmarks, github, helper } = require('../services');
const $ = require('../util');
const BuildStatus = require('./build-status');

const DEFAULT_REPO_NAME = 'Pages';				// for ungrouped pages
const DEFAULT_PROJECTS_REPO_NAME = 'Projects';	// for ungrouped projects
const issueTypeCls = {
	pr: 'ion-ios-git-pull-request',
	issue: 'ion-ios-bug-outline',
	project: 'ion-ios-cube-outline',
	page: 'ion-ios-document-outline',
	default: 'ion-ios-document-outline',
};


const template = `
	{{#bookmarks:repo}}
		<div class="repo-box">
			<h2>
				{{#if hasUrl }}
					<span class="hdr">{{repoShortName}}</span>
				{{else}}
					<a href="{{repoUrl}}" class="hdr" on-click="openRepo">{{repoShortName}}</a>
				{{/if}}
			</h2>
			<ul class="repo-box-issues">
				{{#items}}
					<li class="issue-box {{issueCls(this)}} {{state}} type-{{type}} {{unread ? 'unread' : ''}}">
						<i class="issue-icon {{issueIcon(this)}}"></i>
						<a href="{{url}}" class="btn bookmark" title="{{id || name}}" on-click="openIssue">{{name}}</a>
						{{#if type === 'pr'}}<BuildStatus issue="{{this}}" />{{/if}}
					</li>
				{{/items}}
			</ul>
		</div>
	{{/bookmarks}}
`;


const data = {
	bookmarks: {} ,
	issueCls: iss => {
		const repo = (iss.repo || '').replace(/[\/\.]/g, '-').toLowerCase();
		return iss.id ? `issue-${repo}-${iss.id}` : '';
	},
	issueIcon: iss => issueTypeCls[iss.type],
};



let throttled = null;
const throttle = () => {
	if (throttled) clearTimeout(throttled);
	throttled = setTimeout(() => { throttled = null; }, 1000);
};

function openIssue (e) {
	e.original.preventDefault();
	if (throttled) return throttle();	// if clicked during quiet time - throttle again
	throttle();
	const iss = e.get();
	if (iss) {
		iss.unread = false;
		bookmarks.setUnreadByUrl(iss.url, false);
		$.trigger(EVENT.url.change.to, iss.url);
	}
}


function openRepo (e) {
	$.trigger(EVENT.url.change.to, e.get().repoUrl);
	return false;
}


function addBookmark (issue) {
	bookmarks.add(issue).then(refresh);
}

function removeBookmark (issue) {
	bookmarks.remove(issue).then(refresh);
}


function onUrlChanged (wv, issue) {
	if (!issue || !issue.url) return;
	const repo = data.bookmarks[issue.repo];
	if (repo) {
		const iss = repo.items.filter(i => i.url === issue.url)[0];
		if (iss) iss.unread = false;
	}
	bookmarks.setUnreadByUrl(issue.url, false);
}


function refresh () {
	bookmarks.get()
		.then(render)
		.then(github.checkIssuesForUpdates)
		.then(render);
}


function copleteIssueModel (iss) {
	if (!iss.repo) {
		if (helper.getPageActualTypeFromUrl(iss.url) === 'project') {
			iss.repo = DEFAULT_PROJECTS_REPO_NAME;
			iss.type = 'project';
		}
		else {
			iss.repo = DEFAULT_REPO_NAME;
			iss.type = 'page';
		}
	}
	iss.build = iss.build || {};
	return iss;
}


function render (issues) {
	issues = issues.map(copleteIssueModel);
	data.bookmarks = helper.groupIssues(issues);
	return issues;
}


function oninit () {
	$.on(EVENT.bookmark.add, addBookmark);
	$.on(EVENT.bookmark.remove, removeBookmark);
	$.on(EVENT.bookmarks.refresh, refresh);
	$.on(EVENT.url.change.done, onUrlChanged);
	this.on({ openRepo, openIssue });
	refresh();
}

module.exports = new Ractive({
	el: '#subnav .subnav-bookmarks .subnav-section-list',
	magic: true,
	data,
	template,
	oninit,
	components: {
		BuildStatus
	}
});